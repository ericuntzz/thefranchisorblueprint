"use client";

/**
 * VoiceIntakeButton — record a 30-second to 30-minute voice intake
 * directly into a chapter.
 *
 * Click → start recording (MediaRecorder API on the customer's mic).
 * Click again → stop, upload to /api/agent/voice with the chapter slug.
 * The server saves the audio + (when OPENAI_API_KEY is present)
 * transcribes via Whisper and appends "## Voice intake — {date}"
 * to the chapter's content_md.
 *
 * Browser support: every modern browser ships MediaRecorder; we
 * feature-detect anyway and hide the button on browsers without it
 * (rare, mostly older Safari).
 *
 * Permissions: navigator.mediaDevices.getUserMedia prompts the
 * customer for mic access on first use; we surface the rejection
 * cleanly if they say no.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AlertTriangle } from "lucide-react";

type Props = {
  slug: string;
  /** Optional callback after a successful upload — e.g. router.refresh(). */
  onSuccess?: (data: { audioPath: string; transcribed: boolean }) => void;
};

type RecorderState = "idle" | "requesting" | "recording" | "uploading";

export function VoiceIntakeButton({ slug, onSuccess }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature detection.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function"
    ) {
      setSupported(true);
    } else {
      setSupported(false);
    }
  }, []);

  // Tick the elapsed-time clock while recording.
  useEffect(() => {
    if (state !== "recording") {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state]);

  // Cleanup any active stream on unmount.
  useEffect(() => {
    return () => {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
        r.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (supported === false) return null;

  async function startRecording() {
    setErr(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Choose a widely-supported codec. webm/opus is supported on
      // Chrome/Edge/Firefox; Safari falls back to mp4/aac. We let
      // the browser pick if our preferred mime isn't supported.
      const preferredMime = "audio/webm;codecs=opus";
      const mime = MediaRecorder.isTypeSupported(preferredMime)
        ? preferredMime
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        const ev = e as Event & { error?: Error };
        setErr(ev.error?.message ?? "Recorder error");
        setState("idle");
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "NotAllowedError"
            ? "Mic access denied. Allow it in your browser settings and try again."
            : e.message
          : "Couldn't access mic";
      setErr(msg);
      setState("idle");
    }
  }

  async function stopAndUpload() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setState("uploading");
    try {
      // Wrap stop() in a Promise so we can await the final ondataavailable.
      const stopPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
      await stopPromise;

      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `intake.${ext}`);
      fd.append("slug", slug);
      const res = await fetch("/api/agent/voice", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        audioPath: string;
        transcribed: boolean;
      };
      onSuccess?.(data);
      setState("idle");
      setElapsedMs(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setState("idle");
    }
  }

  const elapsedLabel = formatElapsed(elapsedMs);

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-50 border border-red-300 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-red-700 tabular-nums">
          REC {elapsedLabel}
        </span>
        <button
          type="button"
          onClick={() => void stopAndUpload()}
          className="inline-flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 font-bold text-xs uppercase tracking-[0.1em] px-3 py-1.5 rounded-full transition-colors"
        >
          <Square size={12} />
          Stop & save
        </button>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-cream/60 border border-navy/15 px-3 py-2 text-xs text-navy font-bold">
        <Loader2 size={12} className="animate-spin" />
        Uploading + transcribing…
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void startRecording()}
        disabled={state === "requesting"}
        className="inline-flex items-center gap-1.5 bg-cream text-navy hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors disabled:opacity-50"
      >
        <Mic size={12} />
        {state === "requesting" ? "Requesting mic…" : "Talk to Jason"}
      </button>
      {err && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle size={10} />
          {err}
        </span>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
