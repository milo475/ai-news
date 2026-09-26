/**
 * JSON-LD-г <script>-д хийж рендерлэнэ.
 *
 * Олон схемийг нэг script-д массиваар бичих нь зөв (Google дэмждэг) бөгөөд
 * HTML-ийг бага зэрэг богиносгоно.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Схемийн өгөгдөл нь бидний өөрсдийн объект — JSON.stringify нь </script>-ийг
      // орхидог тул "<"-г escape хийнэ
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
