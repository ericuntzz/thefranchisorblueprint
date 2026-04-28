/**
 * Renders a schema.org JSON-LD block in the document head.
 * Use one per schema entity; multiple JsonLd components are fine.
 *
 * Server-component safe — emits a static <script> tag with no client JS.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
