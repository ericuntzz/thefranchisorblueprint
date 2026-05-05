/**
 * Whisper transcription wrapper.
 *
 * Env-gated: requires `OPENAI_API_KEY`. When unset, every call returns
 * `{ ok: false, reason: "no_api_key" }` and the route falls back to
 * "audio saved, transcription unavailable" — the file still lives in
 * storage and can be re-processed later when a key lands.
 *
 * Why direct fetch instead of the OpenAI SDK: the SDK pulls in 1MB+
 * of dependencies for a single endpoint. We're stable on Whisper's
 * v1 transcription endpoint with simple multipart bodies; raw fetch
 * keeps the bundle lean.
 *
 * Pricing reference (2026-04): $0.006/minute of audio. A 30-minute
 * intake = $0.18. Tier 1 customer at $3K → margins are fine.
 */

import "server-only";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "whisper-1";

export type WhisperResult =
  | {
      ok: true;
      text: string;
      durationSec?: number;
      language?: string;
    }
  | {
      ok: false;
      reason: "no_api_key" | "api_error" | "request_error";
      message?: string;
    };

/**
 * Transcribe an audio buffer via Whisper. Accepts MP3, MP4 (m4a),
 * WAV, WebM, etc. — Whisper handles the format detection itself.
 *
 * `filename` is used by the API to infer mime type; pass something
 * with a recognizable extension (e.g. "intake.webm").
 */
export async function transcribeAudio(args: {
  buffer: Buffer | ArrayBuffer | Uint8Array;
  filename: string;
  /** Optional language hint to improve accuracy. ISO 639-1 ("en", "es"). */
  language?: string;
  /** Optional prompt to bias transcription (jargon, names, etc.). */
  prompt?: string;
}): Promise<WhisperResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "no_api_key" };
  }

  // Normalize to Uint8Array for the FormData blob. Buffer extends
  // Uint8Array, so the instanceof check covers both.
  let bytes: Uint8Array;
  if (args.buffer instanceof Uint8Array) {
    bytes = args.buffer;
  } else {
    // ArrayBuffer fallback.
    bytes = new Uint8Array(args.buffer);
  }

  const form = new FormData();
  // Inferring content-type from extension is fine for Whisper; pass
  // application/octet-stream and let the server decide.
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    args.filename,
  );
  form.append("model", WHISPER_MODEL);
  form.append("response_format", "verbose_json");
  if (args.language) form.append("language", args.language);
  if (args.prompt) form.append("prompt", args.prompt);

  let res: Response;
  try {
    res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "request_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "api_error",
      message: `${res.status}: ${body.slice(0, 500)}`,
    };
  }
  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    language?: string;
  };
  return {
    ok: true,
    text: json.text ?? "",
    durationSec: json.duration,
    language: json.language,
  };
}

/** Cheap probe — does the env have a Whisper key configured? */
export function isVoiceTranscriptionAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
