/**
 * Voice intake endpoint.
 *
 *   POST /api/agent/voice
 *     body: multipart/form-data
 *       audio: File (the recording — webm/mp3/m4a/wav)
 *       slug?: MemoryFileSlug — section to attach the transcript to
 *
 *   Behavior:
 *     1. Auth + paid gate.
 *     2. Upload audio to customer-uploads/{user_id}/voice/{ts}.webm
 *     3. If OPENAI_API_KEY is set: call Whisper, save .transcript.json,
 *        and append the transcript to the section's content_md as a
 *        `## Voice intake — {date}` section.
 *     4. If unset: return { ok: true, transcribed: false } so the
 *        client can show "audio saved, transcription will run when
 *        the key is configured."
 *
 *   Response: { ok, audioPath, transcriptPath?, transcriptPreview? }
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import {
  isVoiceTranscriptionAvailable,
  transcribeAudio,
} from "@/lib/agent/voice";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
// Whisper transcription on a 30-min audio file takes ~5–15s plus
// upload time; 60s is comfortable for the worst case.
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper limit; defends against runaway uploads

export async function POST(req: NextRequest) {
  // Auth + paid gate.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Pick<Purchase, "status">[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }

  // Parse multipart form.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const audio = form.get("audio");
  const slugRaw = form.get("slug");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Empty audio" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio too large (max ${MAX_AUDIO_BYTES / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }
  const slug =
    typeof slugRaw === "string" && isValidMemoryFileSlug(slugRaw) ? slugRaw : null;

  // Pick a stable filename for the storage object.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const audioExtMatch = audio.name.match(/\.[a-zA-Z0-9]+$/);
  const ext = audioExtMatch ? audioExtMatch[0].toLowerCase() : ".webm";
  const audioPath = `${user.id}/voice/${ts}${ext}`;

  // Upload audio to storage (admin client because RLS is bucket-scoped).
  const admin = getSupabaseAdmin();
  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("customer-uploads")
    .upload(audioPath, audioBuffer, {
      contentType: audio.type || "audio/webm",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[voice] audio upload failed:", uploadErr.message);
    return NextResponse.json(
      { error: `Audio upload failed: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // Whisper — env-gated. If no key, return early with audio saved.
  if (!isVoiceTranscriptionAvailable()) {
    return NextResponse.json({
      ok: true,
      audioPath,
      transcribed: false,
      reason:
        "OPENAI_API_KEY not configured — audio saved; transcription will run once the key is added.",
    });
  }

  const result = await transcribeAudio({
    buffer: audioBuffer,
    filename: `intake${ext}`,
  });
  if (!result.ok) {
    console.warn("[voice] transcription failed (non-fatal):", result.reason, result.message ?? "");
    return NextResponse.json({
      ok: true,
      audioPath,
      transcribed: false,
      reason: `Transcription failed (${result.reason}). Audio saved for later retry.`,
    });
  }

  // Save transcript JSON alongside the audio.
  const transcriptPath = `${user.id}/voice/${ts}.transcript.json`;
  const transcriptJson = {
    audioPath,
    transcribedAt: new Date().toISOString(),
    durationSec: result.durationSec ?? null,
    language: result.language ?? null,
    text: result.text,
  };
  const { error: tErr } = await admin.storage
    .from("customer-uploads")
    .upload(
      transcriptPath,
      Buffer.from(JSON.stringify(transcriptJson, null, 2), "utf-8"),
      {
        contentType: "application/json",
        upsert: false,
      },
    );
  if (tErr) {
    console.warn("[voice] transcript upload failed:", tErr.message);
  }

  // If a section slug was provided, append the transcript to that
  // section's content_md so the customer can see the words they spoke
  // already showing up in their Blueprint. This is the "watch your
  // Blueprint draft live" moment from the planning doc.
  if (slug) {
    const dateLabel = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const heading = `\n\n## Voice intake — ${dateLabel}\n\n${result.text}\n`;
    const { data: row } = await admin
      .from("customer_memory")
      .select("content_md")
      .eq("user_id", user.id)
      .eq("file_slug", slug)
      .maybeSingle();
    const next = (row?.content_md ?? "") + heading;
    const { error: upsertErr } = await admin.from("customer_memory").upsert(
      {
        user_id: user.id,
        file_slug: slug,
        content_md: next,
        last_updated_by: "user",
      },
      { onConflict: "user_id,file_slug" },
    );
    if (upsertErr) {
      console.warn("[voice] memory append failed:", upsertErr.message);
    }
    revalidatePath(`/portal/section/${slug}`);
    revalidatePath(`/portal/lab/blueprint`);
  }

  return NextResponse.json({
    ok: true,
    audioPath,
    transcriptPath,
    transcribed: true,
    transcriptPreview:
      result.text.length > 400 ? result.text.slice(0, 400) + "…" : result.text,
    durationSec: result.durationSec,
  });
}
