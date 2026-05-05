/**
 * DeliverableDoc → markdown string renderer.
 *
 * Used for the pre-export review screen (the customer reads the
 * markdown preview before downloading) and for the `format=md` API
 * variant. The DOCX renderer is the canonical download; markdown is
 * the lightweight preview.
 *
 * Output style: GitHub-flavored markdown. Tables render as proper
 * pipe-tables (rather than the kvtable's labeled-row form) since
 * GFM tables read cleanly in any markdown viewer.
 */

import type { DeliverableDoc, DocBlock, DocSection } from "./types";

export function renderMarkdown(doc: DeliverableDoc): string {
  const lines: string[] = [];

  // ── Cover ─────────────────────────────────────────────────────────────
  lines.push(`# ${doc.title}`);
  if (doc.subtitle) {
    lines.push("", `_${doc.subtitle}_`);
  }
  if (doc.coverFields && doc.coverFields.length > 0) {
    lines.push("");
    for (const cf of doc.coverFields) {
      lines.push(`- **${cf.label}:** ${cf.value}`);
    }
  }
  if (doc.disclaimer) {
    lines.push("", "---", "", `> ${doc.disclaimer}`);
  }
  lines.push("", "---", "");

  // ── Body ──────────────────────────────────────────────────────────────
  for (const section of doc.sections) {
    pushSection(lines, section);
  }

  return lines.join("\n");
}

function pushSection(lines: string[], section: DocSection): void {
  const prefix = section.level === 1 ? "## " : "### ";
  lines.push(`${prefix}${section.title}`, "");
  for (const block of section.blocks) {
    pushBlock(lines, block);
  }
  if (section.subsections) {
    for (const sub of section.subsections) {
      pushSection(lines, sub);
    }
  }
}

function pushBlock(lines: string[], block: DocBlock): void {
  switch (block.kind) {
    case "paragraph": {
      let text = block.text;
      if (block.bold) text = `**${text}**`;
      if (block.italic) text = `_${text}_`;
      lines.push(text, "");
      return;
    }
    case "bullets": {
      for (const item of block.items) lines.push(`- ${item}`);
      lines.push("");
      return;
    }
    case "numbered": {
      block.items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      lines.push("");
      return;
    }
    case "kvtable": {
      lines.push("| Field | Value |", "| --- | --- |");
      for (const r of block.rows) {
        const value = r.value.replace(/\n/g, " ").replace(/\|/g, "\\|");
        lines.push(`| **${r.label}** | ${value} |`);
      }
      lines.push("");
      return;
    }
    case "callout": {
      const icon = block.tone === "warning" ? "⚠️" : block.tone === "info" ? "ℹ️" : "📝";
      lines.push(`> ${icon} _${block.text}_`, "");
      return;
    }
    case "spacer": {
      lines.push("");
      return;
    }
    case "pagebreak": {
      lines.push("", "---", "");
      return;
    }
  }
}
