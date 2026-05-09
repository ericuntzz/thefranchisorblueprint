import { Heading, Hr, Section, Text } from "@react-email/components";
import {
  EmailLayout,
  eyebrowStyle,
  headingStyle,
  paragraphStyle,
  subheadingStyle,
  callOutStyle,
} from "./_layout";
import type { OpsDigestPayload } from "@/lib/ops/types";

export type { OpsDigestPayload };

export function teamOpsDigestSubject(p: OpsDigestPayload): string {
  return `TFB Ops — ${p.dateLabel}`;
}

const sectionDivider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid rgba(30, 58, 95, 0.08)",
  margin: "24px 0",
};

const metricRow: React.CSSProperties = {
  display: "flex",
  margin: "0 0 4px",
};

const metricLabel: React.CSSProperties = {
  color: "#888B92",
  fontSize: "13px",
  margin: 0,
};

const metricValue: React.CSSProperties = {
  color: "#1E3A5F",
  fontSize: "13px",
  fontWeight: 700,
  margin: 0,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
  margin: "8px 0 0",
};

const thStyle: React.CSSProperties = {
  textAlign: "left" as const,
  color: "#888B92",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  padding: "4px 8px 4px 0",
  borderBottom: "1px solid rgba(30, 58, 95, 0.08)",
};

const tdStyle: React.CSSProperties = {
  color: "#4F5562",
  padding: "6px 8px 6px 0",
  borderBottom: "1px solid rgba(30, 58, 95, 0.04)",
  verticalAlign: "top" as const,
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  padding: "2px 6px",
  borderRadius: "4px",
};

const badgeGreen: React.CSSProperties = {
  ...badgeBase,
  backgroundColor: "#dcfce7",
  color: "#166534",
};

const badgeAmber: React.CSSProperties = {
  ...badgeBase,
  backgroundColor: "#fef3c7",
  color: "#92400e",
};

const badgeRed: React.CSSProperties = {
  ...badgeBase,
  backgroundColor: "#fee2e2",
  color: "#991b1b",
};

const badgeGrey: React.CSSProperties = {
  ...badgeBase,
  backgroundColor: "#f3f4f6",
  color: "#6b7280",
};

export function TeamOpsDigestEmail(p: OpsDigestPayload) {
  const totalRevenue24h = p.newCustomers.reduce(
    (sum, c) => sum + c.amountCents,
    0,
  );

  return (
    <EmailLayout>
      <Text style={eyebrowStyle}>Daily Ops Digest</Text>
      <Heading as="h1" style={headingStyle}>
        {p.dateLabel}
      </Heading>

      {/* ── Quick metrics ── */}
      <Section style={callOutStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 0", width: "50%" }}>
                <Text style={metricLabel}>New customers</Text>
                <Text style={metricValue}>{p.newCustomers.length}</Text>
              </td>
              <td style={{ padding: "4px 0", width: "50%" }}>
                <Text style={metricLabel}>Revenue (24h)</Text>
                <Text style={metricValue}>
                  {totalRevenue24h > 0
                    ? `$${(totalRevenue24h / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                    : "$0"}
                </Text>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0" }}>
                <Text style={metricLabel}>Rescue emails sent</Text>
                <Text style={metricValue}>{p.rescueResults.length}</Text>
              </td>
              <td style={{ padding: "4px 0" }}>
                <Text style={metricLabel}>Refund watchlist</Text>
                <Text style={metricValue}>
                  {p.refundWatchlist.length > 0
                    ? `${p.refundWatchlist.length} ⚠`
                    : "0 ✓"}
                </Text>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0" }}>
                <Text style={metricLabel}>Assessment leads</Text>
                <Text style={metricValue}>{p.assessmentLeads.length}</Text>
              </td>
              <td style={{ padding: "4px 0" }}>
                <Text style={metricLabel}>Missed warm leads</Text>
                <Text style={metricValue}>
                  {p.missedWarmLeads.length > 0
                    ? `${p.missedWarmLeads.length} ⚠`
                    : "0 ✓"}
                </Text>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 0" }}>
                <Text style={metricLabel}>Emails (24h)</Text>
                <Text style={metricValue}>
                  {p.emailHealth.failed24h > 0
                    ? `${p.emailHealth.sent24h} sent / ${p.emailHealth.failed24h} failed`
                    : `${p.emailHealth.sent24h} sent ✓`}
                </Text>
              </td>
              <td style={{ padding: "4px 0" }}></td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* ── New customers ── */}
      {p.newCustomers.length > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            New customers
          </Heading>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.newCustomers.map((c, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    {c.firstName ?? "—"}{" "}
                    <span style={{ color: "#888B92" }}>({c.email})</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={c.tier === 3 ? badgeGreen : c.tier === 2 ? badgeAmber : badgeGrey}>
                      {c.tierName}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    ${(c.amountCents / 100).toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Rescue results ── */}
      {p.rescueResults.length > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            Stuck-customer rescues sent
          </Heading>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Days idle</th>
                <th style={thStyle}>Next section</th>
              </tr>
            </thead>
            <tbody>
              {p.rescueResults.map((r, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    {r.firstName ?? "—"}{" "}
                    <span style={{ color: "#888B92" }}>({r.email})</span>
                  </td>
                  <td style={tdStyle}>{r.daysIdle}d</td>
                  <td style={tdStyle}>{r.nextSection}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Early-customer watchlist ── */}
      {p.refundWatchlist.length > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            Early-customer watchlist
          </Heading>
          <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92" }}>
            Customers in their first 30 days with &lt;50% readiness — outreach candidates.
          </Text>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Days left</th>
                <th style={thStyle}>Readiness</th>
                <th style={thStyle}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {p.refundWatchlist.map((w, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    {w.firstName ?? "—"}{" "}
                    <span style={{ color: "#888B92" }}>({w.email})</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={w.daysRemaining <= 3 ? badgeRed : badgeAmber}>
                      {w.daysRemaining}d
                    </span>
                  </td>
                  <td style={tdStyle}>{w.readinessPct}%</td>
                  <td style={tdStyle}>{w.tierName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Missed warm leads — Jason's personal follow-up watchlist ── */}
      {p.missedWarmLeads.length > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            Missed warm leads — chase these
          </Heading>
          <Text style={{ ...paragraphStyle, fontSize: "13px", color: "#888B92" }}>
            Hot-band leads (franchise_ready / nearly_there) from the last 7
            days who haven&apos;t booked a strategy call OR purchased.
            Reach out personally.
          </Text>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Band</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Urgency</th>
                <th style={thStyle}>Days ago</th>
              </tr>
            </thead>
            <tbody>
              {p.missedWarmLeads.map((l, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    {l.firstName ?? "—"}{" "}
                    <span style={{ color: "#888B92" }}>({l.email})</span>
                    {l.businessName && (
                      <span style={{ color: "#888B92", fontSize: "12px" }}>
                        {" "}
                        · {l.businessName}
                      </span>
                    )}
                    {l.websiteUrl && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={l.websiteUrl}
                          style={{ color: "#1E3A5F", fontSize: "12px" }}
                        >
                          site
                        </a>
                      </>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={
                        l.band === "franchise_ready" ? badgeGreen : badgeAmber
                      }
                    >
                      {l.band.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={tdStyle}>{l.score}</td>
                  <td style={tdStyle}>
                    {l.urgency ? l.urgency.replace(/_/g, " ") : "—"}
                  </td>
                  <td style={tdStyle}>{l.daysSinceCompletion}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Assessment leads ── */}
      {p.assessmentLeads.length > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            Assessment leads (not yet purchased)
          </Heading>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Who</th>
                <th style={thStyle}>Band</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Days ago</th>
              </tr>
            </thead>
            <tbody>
              {p.assessmentLeads.slice(0, 15).map((l, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    {l.firstName ?? "—"}{" "}
                    <span style={{ color: "#888B92" }}>({l.email})</span>
                    {l.businessName && (
                      <span style={{ color: "#888B92", fontSize: "12px" }}>
                        {" "}
                        · {l.businessName}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={
                        l.band === "franchise_ready"
                          ? badgeGreen
                          : l.band === "nearly_there"
                            ? badgeAmber
                            : badgeGrey
                      }
                    >
                      {l.band.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={tdStyle}>{l.score}</td>
                  <td style={tdStyle}>{l.daysSinceCompletion}d</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.assessmentLeads.length > 15 && (
            <Text style={{ ...paragraphStyle, fontSize: "12px", color: "#888B92" }}>
              + {p.assessmentLeads.length - 15} more leads (check Supabase for full list)
            </Text>
          )}
        </>
      )}

      {/* ── Email health ── */}
      {p.emailHealth.failed24h > 0 && (
        <>
          <Hr style={sectionDivider} />
          <Heading as="h2" style={subheadingStyle}>
            Email failures (last 24h)
          </Heading>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Recipient</th>
                <th style={thStyle}>Template</th>
                <th style={thStyle}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {p.emailHealth.failures.slice(0, 10).map((f, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{f.recipient}</td>
                  <td style={tdStyle}>{f.template}</td>
                  <td style={tdStyle}>{f.reason ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Stripe + platform health stubs ── */}
      <Hr style={sectionDivider} />
      <Heading as="h2" style={subheadingStyle}>
        Infrastructure
      </Heading>
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={tdStyle}>Stripe reconciliation</td>
            <td style={tdStyle}>
              {p.stripeReconciliation.status === "not_configured" ? (
                <span style={badgeGrey}>not configured</span>
              ) : p.stripeReconciliation.status === "ok" ? (
                <span style={badgeGreen}>ok</span>
              ) : (
                <span style={badgeRed}>
                  {p.stripeReconciliation.issueCount} issue
                  {p.stripeReconciliation.issueCount === 1 ? "" : "s"}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td style={tdStyle}>Platform health</td>
            <td style={tdStyle}>
              {p.platformHealth.status === "not_configured" ? (
                <span style={badgeGrey}>not configured</span>
              ) : p.platformHealth.status === "all_clear" ? (
                <span style={badgeGreen}>all clear</span>
              ) : (
                <span style={badgeRed}>
                  {p.platformHealth.incidentCount} incident
                  {p.platformHealth.incidentCount === 1 ? "" : "s"}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Footer note ── */}
      <Hr style={sectionDivider} />
      <Text
        style={{
          ...paragraphStyle,
          fontSize: "12px",
          color: "#888B92",
          margin: 0,
        }}
      >
        This digest is sent daily at 7:00 AM MDT. View live data at{" "}
        <a
          href={`${p.siteUrl}/portal`}
          style={{ color: "#1E3A5F", fontWeight: 600 }}
        >
          thefranchisorblueprint.com/portal
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export function teamOpsDigestText(p: OpsDigestPayload): string {
  const lines: string[] = [
    `TFB Ops Digest — ${p.dateLabel}`,
    "",
    `New customers: ${p.newCustomers.length}`,
    `Revenue (24h): $${(p.newCustomers.reduce((s, c) => s + c.amountCents, 0) / 100).toFixed(0)}`,
    `Rescue emails sent: ${p.rescueResults.length}`,
    `Refund watchlist: ${p.refundWatchlist.length}`,
    `Assessment leads: ${p.assessmentLeads.length}`,
    `Missed warm leads: ${p.missedWarmLeads.length}`,
    `Emails: ${p.emailHealth.sent24h} sent, ${p.emailHealth.failed24h} failed`,
    "",
  ];

  if (p.newCustomers.length > 0) {
    lines.push("NEW CUSTOMERS:");
    for (const c of p.newCustomers) {
      lines.push(
        `  ${c.firstName ?? "—"} (${c.email}) — ${c.tierName} — $${(c.amountCents / 100).toFixed(0)}`,
      );
    }
    lines.push("");
  }

  if (p.rescueResults.length > 0) {
    lines.push("RESCUE EMAILS:");
    for (const r of p.rescueResults) {
      lines.push(
        `  ${r.firstName ?? "—"} (${r.email}) — ${r.daysIdle}d idle → ${r.nextSection}`,
      );
    }
    lines.push("");
  }

  if (p.refundWatchlist.length > 0) {
    lines.push("REFUND WATCHLIST:");
    for (const w of p.refundWatchlist) {
      lines.push(
        `  ${w.firstName ?? "—"} (${w.email}) — ${w.daysRemaining}d left, ${w.readinessPct}% ready`,
      );
    }
    lines.push("");
  }

  if (p.missedWarmLeads.length > 0) {
    lines.push("MISSED WARM LEADS — chase these:");
    for (const l of p.missedWarmLeads) {
      lines.push(
        `  ${l.firstName ?? "—"} (${l.email}) — ${l.band.replace(/_/g, " ")} ${l.score} — ${l.daysSinceCompletion}d ago${l.urgency ? ` — ${l.urgency.replace(/_/g, " ")}` : ""}`,
      );
    }
    lines.push("");
  }

  if (p.assessmentLeads.length > 0) {
    lines.push("ASSESSMENT LEADS:");
    for (const l of p.assessmentLeads.slice(0, 15)) {
      lines.push(
        `  ${l.firstName ?? "—"} (${l.email}) — ${l.band.replace(/_/g, " ")} (${l.score}) — ${l.daysSinceCompletion}d ago`,
      );
    }
    if (p.assessmentLeads.length > 15) {
      lines.push(`  + ${p.assessmentLeads.length - 15} more`);
    }
    lines.push("");
  }

  if (p.emailHealth.failed24h > 0) {
    lines.push("EMAIL FAILURES:");
    for (const f of p.emailHealth.failures.slice(0, 10)) {
      lines.push(`  ${f.recipient} — ${f.template} — ${f.reason ?? "unknown"}`);
    }
    lines.push("");
  }

  lines.push(
    `Stripe reconciliation: ${p.stripeReconciliation.status}`,
    `Platform health: ${p.platformHealth.status}`,
  );

  return lines.join("\n");
}
