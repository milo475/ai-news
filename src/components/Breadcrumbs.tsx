import { breadcrumbJsonLd, type Crumb } from "@/lib/jsonld.api";
import { siteUrl } from "@/lib/site";
import { JsonLd } from "./JsonLd";

/**
 * BreadcrumbList схем. Google хайлтын үр дүнд хаягийн оронд замыг
 * («AI News › Заавар › ...») үзүүлдэг — дарах магадлалыг нэмэгдүүлнэ.
 *
 * «Нүүр»-ийг өөрөө нэмдэг тул зөвхөн доод шатуудыг дамжуулна.
 */
export function BreadcrumbLd({ crumbs }: { crumbs: Crumb[] }) {
  return <JsonLd data={breadcrumbJsonLd(siteUrl(), crumbs)} />;
}
