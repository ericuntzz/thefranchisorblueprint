"use client";

import { useEffect, useState } from "react";

export function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (now === null) {
    // SSR placeholder — avoids hydration flicker
    return (
      <span className="font-mono tabular-nums" aria-label="Loading countdown">
        --:--:--
      </span>
    );
  }

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return <span className="font-mono tabular-nums text-grey-4">Promo ended</span>;
  }

  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <span className="font-mono tabular-nums">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
