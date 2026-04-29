import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ArrowRight,
  ChevronRight,
  Layers,
  Lock,
  Sparkles,
} from "lucide-react";

/**
 * Polished MacBook hero showcasing the actual TFB customer portal interior.
 *
 * Replaces the earlier 3-device wireframe pile-up. Single device, real-
 * looking product UI inside, soft cinematic lighting around it. The point
 * of this section is "you get a real product, not a binder" — so we render
 * the portal verbatim instead of stylized doc placeholders.
 *
 * Pure CSS / JSX. No image dependencies. The portal interior mirrors the
 * production /portal layout (welcome → progress meter → next-move CTA →
 * phase containers) so it auto-evokes the same brand language without us
 * having to keep two designs in sync visually — only the data is fixed.
 */
export function DeviceMockups() {
  return (
    <div className="relative w-full max-w-[680px] mx-auto">
      {/* ── Soft backdrop glow ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(212,175,55,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        aria-hidden
      />

      {/* ── MacBook ────────────────────────────────────────────────────── */}
      <div className="relative drop-shadow-[0_40px_70px_rgba(0,0,0,0.45)]">
        {/* Lid + bezel */}
        <div className="bg-gradient-to-b from-[#1f2024] to-[#0e0f12] rounded-t-[14px] p-[5px] pb-[3px]">
          {/* Inner bezel */}
          <div className="bg-[#0a0b0d] rounded-t-[10px] p-[4px]">
            {/* Top notch row (camera dot) */}
            <div className="flex justify-center pb-[2px]">
              <span
                className="w-1 h-1 rounded-full bg-[#1f2024]"
                aria-hidden
              />
            </div>
            {/* The screen itself, 16:10 aspect ratio = real MacBook spec */}
            <div className="bg-white rounded-[6px] aspect-[16/10] overflow-hidden flex flex-col">
              {/* Browser chrome */}
              <BrowserChrome />
              {/* Portal UI */}
              <PortalScreen />
            </div>
          </div>
        </div>

        {/* Hinge: dark thin strip */}
        <div className="h-[5px] bg-gradient-to-b from-[#16171a] via-[#1c1d20] to-[#0a0b0d] mx-[-2.5%]" />
        {/* Base lip: lighter, with subtle indent */}
        <div className="h-[8px] bg-gradient-to-b from-[#22232673] to-[#0e0f12] rounded-b-[10px] mx-[-3%] relative">
          {/* Trackpad slot indicator */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] h-[2px] rounded-full bg-black/40"
            aria-hidden
          />
        </div>
      </div>

      {/* ── Floating capability detail card ─────────────────────────────
          Adds depth + reinforces "open a capability and there's substance".
          Sits below-left, slightly overlapping the laptop's lower edge. */}
      <FloatingCapabilityCard />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function BrowserChrome() {
  return (
    <div className="bg-grey-1 border-b border-black/5 px-2.5 py-1.5 flex items-center gap-1.5 flex-shrink-0">
      <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
      <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
      <span className="w-2 h-2 rounded-full bg-[#28c840]" />
      <div className="ml-2 flex-1 bg-white border border-black/5 rounded-[4px] px-2 py-0.5 flex items-center gap-1">
        <Lock size={6} className="text-grey-4 flex-shrink-0" strokeWidth={2.5} />
        <span className="text-[6px] text-grey-3 truncate font-medium">
          thefranchisorblueprint.com/portal
        </span>
      </div>
    </div>
  );
}

function PortalScreen() {
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Portal nav bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-black/5 flex-shrink-0"
        style={{ backgroundColor: "#ece9df" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
            <span className="text-gold text-[7px] font-extrabold">TFB</span>
          </div>
          <div>
            <div className="text-[7px] font-extrabold text-navy leading-none">
              The Franchisor Blueprint
            </div>
            <div className="text-[5px] font-bold tracking-[0.12em] text-navy/60 uppercase mt-0.5">
              Customer Portal
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[6px] font-semibold text-navy/75">Sarah K.</span>
          <span className="text-[5px] text-navy/50">| Sign out</span>
        </div>
      </div>

      {/* Welcome strip */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <div className="text-[5px] font-bold tracking-[0.16em] text-gold-warm uppercase border-b border-gold inline-block pb-px mb-1">
              Welcome to your portal
            </div>
            <div className="text-[12px] font-extrabold text-navy leading-tight">
              Welcome back, Sarah
            </div>
            <div className="text-[6px] text-grey-3 mt-0.5">
              Your franchisor operating system — 3 of 9 capabilities complete.
            </div>
          </div>
          <div className="bg-cream border border-navy/10 rounded-md px-1.5 py-1 text-right flex-shrink-0">
            <div className="text-[4px] font-bold tracking-[0.1em] text-gold-warm uppercase">
              Your access tier
            </div>
            <div className="text-[7px] font-extrabold text-navy mt-0.5">
              The Blueprint
            </div>
          </div>
        </div>

        {/* Progress meter — navy bg, gold fill, 33% example */}
        <div className="bg-blueprint rounded-md px-3 py-2 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Sparkles size={5} className="text-gold" />
              <span className="text-[5px] font-bold tracking-[0.14em] text-gold uppercase">
                % Franchise Ready
              </span>
            </div>
            <span className="text-[10px] font-extrabold text-white tabular-nums">33%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-gold to-[#e6c266] rounded-full" />
          </div>
          <div className="text-[4px] text-white/60 mt-1">
            3 of 9 capabilities marked complete
          </div>
        </div>

        {/* Your Next Move CTA bar */}
        <div className="mt-2 bg-cream border border-navy/10 rounded-md px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-4 h-4 rounded bg-navy flex items-center justify-center flex-shrink-0">
              <ArrowRight size={6} className="text-gold" />
            </div>
            <div className="min-w-0">
              <div className="text-[4px] font-bold tracking-[0.14em] text-gold-warm uppercase">
                Your Next Move
              </div>
              <div className="text-[7px] font-extrabold text-navy leading-tight truncate">
                Decode the FDD
              </div>
            </div>
          </div>
          <div className="bg-gold text-navy text-[5px] font-extrabold tracking-[0.1em] uppercase px-2 py-1 rounded-full flex items-center gap-0.5 flex-shrink-0">
            Continue <ArrowRight size={5} />
          </div>
        </div>
      </div>

      {/* Phase containers — the meat */}
      <div className="px-4 pb-3 pt-1 space-y-1.5 flex-1 overflow-hidden">
        <PhaseContainer
          phase="1"
          title="Discover"
          subtitle="Are you ready to franchise?"
          status="complete"
          capabilities={[
            { num: "01", title: "Audit Your Business", complete: true, kind: "Checklist" },
            { num: "02", title: "Model Your Unit Economics", complete: true, kind: "Document" },
          ]}
        />
        <PhaseContainer
          phase="2"
          title="Architect"
          subtitle="Build your operating system"
          status="current"
          progressLabel="1 of 3 complete"
          capabilities={[
            { num: "03", title: "Decode the FDD", complete: true, kind: "Guide" },
            { num: "04", title: "Codify Your Operations", complete: false, kind: "Manual" },
          ]}
        />
      </div>
    </div>
  );
}

type PhaseProps = {
  phase: string;
  title: string;
  subtitle: string;
  status: "complete" | "current" | "locked";
  progressLabel?: string;
  capabilities: { num: string; title: string; complete: boolean; kind: string }[];
};

function PhaseContainer({
  phase,
  title,
  subtitle,
  status,
  progressLabel,
  capabilities,
}: PhaseProps) {
  const accentBar =
    status === "complete"
      ? "bg-emerald-500"
      : status === "current"
        ? "bg-gold"
        : "bg-grey-3/30";
  const numberBg =
    status === "complete"
      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
      : status === "current"
        ? "bg-navy text-gold border-navy"
        : "bg-grey-2 text-grey-3 border-grey-3/30";
  const statusBadge =
    status === "complete" ? (
      <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[4px] font-bold tracking-[0.1em] uppercase px-1 py-px rounded-full">
        <CheckCircle2 size={5} strokeWidth={3} /> Phase Complete
      </span>
    ) : status === "current" ? (
      <span className="inline-block bg-gold/20 text-gold-warm text-[4px] font-bold tracking-[0.1em] uppercase px-1 py-px rounded-full">
        {progressLabel ?? "In Progress"}
      </span>
    ) : (
      <span className="inline-block bg-grey-2 text-grey-3 text-[4px] font-bold tracking-[0.1em] uppercase px-1 py-px rounded-full">
        Locked
      </span>
    );

  return (
    <div className="rounded-md border border-navy/10 bg-white overflow-hidden">
      <div className="flex items-stretch">
        <div className={`w-1 ${accentBar} flex-shrink-0`} aria-hidden />
        <div className="flex-1 px-2 py-1.5 flex items-start gap-2">
          {/* Phase number circle */}
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-px ${numberBg}`}
          >
            <span className="text-[8px] font-extrabold">{phase}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[4px] font-bold tracking-[0.14em] text-gold-warm uppercase">
                Phase {phase}
              </span>
              <span className="text-[4px] text-grey-4">·</span>
              {statusBadge}
            </div>
            <div className="text-[8px] font-extrabold text-navy leading-tight">
              {title}
            </div>
            <div className="text-[5px] text-grey-3 mt-0.5">{subtitle}</div>
            {/* Capability mini-cards */}
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              {capabilities.map((c) => (
                <div
                  key={c.num}
                  className={`rounded border p-1 ${
                    c.complete
                      ? "border-emerald-300 bg-emerald-50/60"
                      : "border-navy/10 bg-grey-1/50"
                  }`}
                >
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {c.complete ? (
                      <CheckCircle2
                        size={5}
                        className="text-emerald-600"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Circle size={5} className="text-navy/40" strokeWidth={2.5} />
                    )}
                    <span className="text-[4px] font-bold tracking-[0.1em] text-gold-warm uppercase">
                      Capability {c.num}
                    </span>
                  </div>
                  <div className="text-[5px] font-extrabold text-navy leading-tight">
                    {c.title}
                  </div>
                  <div className="text-[3.5px] text-grey-3 mt-0.5 uppercase tracking-wider">
                    {c.kind}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ChevronRight size={6} className="text-navy/30 flex-shrink-0 mt-1" />
        </div>
      </div>
    </div>
  );
}

function FloatingCapabilityCard() {
  return (
    <div
      className="absolute -bottom-8 -right-2 sm:-right-6 md:-right-12 w-[42%] max-w-[260px] z-20 drop-shadow-[0_24px_40px_rgba(0,0,0,0.35)] rotate-[2deg]"
      aria-hidden
    >
      <div className="bg-white rounded-xl border border-navy/10 overflow-hidden">
        {/* Card header */}
        <div className="bg-gradient-to-br from-navy to-navy-light px-3 py-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-gold flex-shrink-0">
            <Layers size={12} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-[7px] font-bold tracking-[0.14em] text-gold uppercase">
              Capability 04
            </div>
            <div className="text-[10px] font-extrabold text-white leading-tight truncate">
              Codify Your Operations
            </div>
          </div>
        </div>
        {/* Card body */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1.5">
            <ClipboardCheck size={9} className="text-gold-warm" strokeWidth={2} />
            <span className="text-[6px] font-bold tracking-[0.12em] text-gold-warm uppercase">
              17-Chapter Manual
            </span>
          </div>
          <div className="space-y-0.5 mb-2">
            {[
              "Brand Standards",
              "Service Delivery",
              "Daily Operations",
              "Vendor Management",
            ].map((c, i) => (
              <div key={c} className="flex items-center gap-1">
                <div
                  className={`w-1 h-1 rounded-full flex-shrink-0 ${
                    i < 2 ? "bg-emerald-500" : "bg-navy/20"
                  }`}
                />
                <span className="text-[7px] text-navy">{c}</span>
              </div>
            ))}
            <div className="text-[6px] text-grey-4 italic pl-2">+ 13 more chapters</div>
          </div>
          <div className="h-1 bg-navy/10 rounded-full overflow-hidden">
            <div className="h-full w-[12%] bg-gradient-to-r from-gold to-[#e6c266] rounded-full" />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[5px] text-grey-4">Progress</span>
            <span className="text-[6px] font-bold text-navy">2 / 17</span>
          </div>
        </div>
      </div>
    </div>
  );
}
