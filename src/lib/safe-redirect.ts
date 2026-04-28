/**
 * Validates a user-supplied `next` redirect path. Prevents open-redirect
 * attacks where an attacker passes `//evil.com/path` (protocol-relative)
 * or `/\evil.com` (path-traversal) — both of which start with `/` but
 * navigate cross-origin in modern browsers.
 *
 * Returns the path if it's a safe same-origin path, otherwise `fallback`.
 */
export function safeNext(value: string | null | undefined, fallback = "/portal"): string {
  if (!value || typeof value !== "string") return fallback;
  // Must start with a single forward slash and not be a protocol-relative URL.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.startsWith("/\\")) return fallback;
  // Disallow URL-encoded backslashes that some clients normalize.
  if (value.toLowerCase().startsWith("/%5c")) return fallback;
  return value;
}
