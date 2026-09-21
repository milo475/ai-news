import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-20 text-center space-y-3">
      <h1 className="text-2xl font-semibold">Хуудас олдсонгүй</h1>
      <Link href="/" className="text-accent hover:underline">Нүүр хуудас руу</Link>
    </div>
  );
}
