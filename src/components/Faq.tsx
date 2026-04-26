"use client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Item = { q: string; a: string };

export function Faq({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-[860px] mx-auto">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="bg-white rounded-lg mb-3 shadow-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full px-7 py-6 font-display text-lg font-bold text-navy flex justify-between items-center text-left hover:bg-gold/5 transition-colors"
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <ChevronDown
                className={`text-gold flex-shrink-0 ml-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                size={22}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="px-7 pb-6 text-grey-3 text-base leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
