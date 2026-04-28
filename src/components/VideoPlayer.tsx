"use client";
import { Play } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Styled video player placeholder.
 * TODO: when Jason's hero video is ready, replace this entire component
 * with a real <iframe> (Vimeo/Loom/YouTube) or <video> element. Keep the
 * outer aspect-video container so layout doesn't shift.
 */
export function VideoPlayer({
  thumbnailSrc = "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1600&q=80",
  caption = "Watch: A 90-second look at how The Franchisor Blueprint works",
  duration = "1:34",
  videoTitle = "Hero overview video",
  videoLocation = "homepage_problem_section",
}: {
  thumbnailSrc?: string;
  caption?: string;
  duration?: string;
  videoTitle?: string;
  videoLocation?: string;
}) {
  return (
    <div className="relative w-full max-w-[960px] mx-auto">
      {/* Player frame */}
      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.35)] bg-[#0a0a0a]">
        {/* Thumbnail */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%), url('${thumbnailSrc}')`,
          }}
          aria-hidden
        />

        {/* Center play button */}
        <button
          type="button"
          aria-label="Play video"
          onClick={() =>
            track("video_play", { video_title: videoTitle, video_location: videoLocation })
          }
          className="absolute inset-0 flex items-center justify-center group cursor-pointer"
        >
          <span className="relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-gold text-navy shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110">
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-gold/40 animate-ping" />
            <Play
              size={36}
              strokeWidth={2}
              className="relative ml-1 fill-navy"
            />
          </span>
        </button>

        {/* Top bar — branded chrome */}
        <div className="absolute top-0 left-0 right-0 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-[11px] font-bold tracking-[0.14em] uppercase">
              Watch Now
            </span>
          </div>
          <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white/90 text-xs font-semibold tabular-nums">{duration}</span>
          </div>
        </div>

        {/* Bottom caption bar */}
        <div className="absolute bottom-0 left-0 right-0 px-5 md:px-7 py-4 md:py-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-white font-semibold text-sm md:text-base max-w-[80%]">
            {caption}
          </div>
        </div>
      </div>
    </div>
  );
}
