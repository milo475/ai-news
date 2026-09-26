import Image from "next/image";
import Link from "next/link";
import type { CardItem } from "@/gallery/queries";
import { fmtDate } from "./format";
import { CATEGORY_LABEL } from "@/agent/category";
import { cardImageUrl } from "@/gallery/card.api";

/** Нүүрний «Өдрийн баримт» — хэвтээ гүйлгэх зурвас */
export function CardStrip({ items }: { items: CardItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
      {items.map((c) => (
        <li key={c.id} className="shrink-0 w-40 sm:w-48 snap-start">
          <Link href={`/barimt/${c.slug}`} className="group block">
            <Image
              src={cardImageUrl(c.id, c.cardAt)}
              alt={c.hook}
              width={1080}
              height={1350}
              sizes="(max-width: 640px) 160px, 192px"
              className="w-full aspect-4/5 object-cover rounded-lg border border-line group-hover:border-accent/50"
            />
            <p className="mt-1.5 text-xs text-muted">
              {CATEGORY_LABEL[c.category]} · {fmtDate(c.publishedAt)}
            </p>
            <p className="text-sm line-clamp-2 group-hover:text-accent">{c.hook}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
