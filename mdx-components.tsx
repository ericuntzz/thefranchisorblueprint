import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Global MDX component overrides for the blog.
 *
 * Tailwind utility classes are baked in here so blog posts read naturally
 * without per-post styling. Designed to match the rest of the site (Inter,
 * navy headings, gold accents).
 */

function H1({ children }: { children?: ReactNode }) {
  return (
    <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mt-12 mb-6">
      {children}
    </h1>
  );
}

function H2({ children }: { children?: ReactNode }) {
  return (
    <h2 className="text-navy text-2xl md:text-3xl font-bold leading-tight tracking-tight mt-12 mb-4">
      {children}
    </h2>
  );
}

function H3({ children }: { children?: ReactNode }) {
  return (
    <h3 className="text-navy text-xl md:text-2xl font-bold leading-tight mt-8 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children?: ReactNode }) {
  return <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">{children}</p>;
}

function UL({ children }: { children?: ReactNode }) {
  return <ul className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5 pl-6 space-y-2 list-disc marker:text-gold">{children}</ul>;
}

function OL({ children }: { children?: ReactNode }) {
  return <ol className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5 pl-6 space-y-2 list-decimal marker:text-gold marker:font-bold">{children}</ol>;
}

function LI({ children }: { children?: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

function Strong({ children }: { children?: ReactNode }) {
  return <strong className="text-navy font-bold">{children}</strong>;
}

function A(props: ComponentPropsWithoutRef<"a">) {
  const { href = "#", children, ...rest } = props;
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:decoration-gold hover:text-gold transition-colors"
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:decoration-gold hover:text-gold transition-colors"
    >
      {children}
    </Link>
  );
}

function Blockquote({ children }: { children?: ReactNode }) {
  return (
    <blockquote className="border-l-4 border-gold pl-6 py-2 my-7 italic text-navy text-lg md:text-xl font-light">
      {children}
    </blockquote>
  );
}

function Code({ children }: { children?: ReactNode }) {
  return (
    <code className="bg-grey-1 text-navy text-[0.9em] px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

function HR() {
  return <hr className="my-12 border-t border-navy/10" />;
}

function Table({ children }: { children?: ReactNode }) {
  return (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse border border-navy/10 rounded-lg overflow-hidden text-sm">
        {children}
      </table>
    </div>
  );
}
function TH({ children }: { children?: ReactNode }) {
  return (
    <th className="bg-grey-1 text-navy font-bold text-left px-4 py-3 border-b border-navy/10">
      {children}
    </th>
  );
}
function TD({ children }: { children?: ReactNode }) {
  return <td className="px-4 py-3 text-grey-3 border-b border-navy/5 align-top">{children}</td>;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: H1,
    h2: H2,
    h3: H3,
    p: P,
    ul: UL,
    ol: OL,
    li: LI,
    strong: Strong,
    a: A,
    blockquote: Blockquote,
    code: Code,
    hr: HR,
    table: Table,
    th: TH,
    td: TD,
    ...components,
  };
}
