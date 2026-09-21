import { umamiConfig } from "@/lib/analytics";
import { UmamiScript } from "./UmamiScript";

/** Env дутуу бол юу ч рендэрлэхгүй (dev дээр чимээгүй) */
export function Umami() {
  const config = umamiConfig(process.env);
  if (!config) return null;
  return <UmamiScript {...config} />;
}
