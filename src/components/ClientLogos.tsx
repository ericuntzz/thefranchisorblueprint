/**
 * Client logo strip — placeholder text treatments.
 * TODO: Replace with real logo SVG/PNG files once Jason confirms usage rights
 * and provides files. Drop the assets into public/logos/clients/ and swap
 * each badge for an <Image>.
 */
const clients = [
  { name: "Casa Vida", subtitle: "" },
  { name: "Black Rifle", subtitle: "Coffee Co." },
  { name: "Cyberbacker", subtitle: "" },
  { name: "Bajio", subtitle: "Mexican Grill" },
];

export function ClientLogos() {
  return (
    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 items-center">
      {clients.map((c) => (
        <div
          key={c.name}
          className="flex flex-col items-center justify-center rounded-full border border-navy/15 bg-cream-light w-28 h-28 md:w-32 md:h-32 px-3 text-center shadow-sm"
        >
          <span className="text-navy font-bold text-sm md:text-base leading-tight">
            {c.name}
          </span>
          {c.subtitle && (
            <span className="text-navy/70 text-[10px] md:text-xs uppercase tracking-wider mt-1">
              {c.subtitle}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
