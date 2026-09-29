/**
 * Мэргэжлийн загварууд — /prompt/studio/m/[slug].
 *
 * Статик өгөгдөл: LLM дуудлагагүй, SSG-д тохиромжтой. Хэрэглэгч жишээ дээр
 * дарахад студи тэр хүсэлт ба урьдчилсан хариултаар бөглөгдөж эхэлнэ.
 */
import type { StudioFormat } from "./studio.api";

export interface PersonaExample {
  /**
   * Постын эхний мөр — тухайн хүний БОДИТ нөхцөл, асуулт хэлбэрээр.
   * Гараар бичсэн (LLM-гүй): insight нь бүтээгдэхүүнээс биш, хүнээс эхэлнэ.
   */
  hook: string;
  request: string;
  format: StudioFormat;
  /** Тодруулах асуултын урьдчилсан хариулт — brief-ийн талбаруудаар */
  answers: Record<string, string>;
}

export interface Persona {
  slug: string;
  name: string;
  title: string;
  intro: string;
  examples: PersonaExample[];
}

/** Мэргэжлийн slug зөв эсэх */
export function isPersonaSlug(slug: string, personas: Persona[]): boolean {
  return personas.some((p) => p.slug === slug);
}

export function personaBySlug(slug: string, personas: Persona[]): Persona | null {
  return personas.find((p) => p.slug === slug) ?? null;
}

/** Жишээг ээлжлэн сонгоно — «Долоо хоногийн промпт»-д давтагдахгүй байх */
export function pickExample(
  personas: Persona[],
  index: number,
): { persona: Persona; example: PersonaExample; key: string } | null {
  const flat = personas.flatMap((persona) =>
    persona.examples.map((example, i) => ({ persona, example, key: `${persona.slug}:${i}` })),
  );
  if (flat.length === 0) return null;
  return flat[((index % flat.length) + flat.length) % flat.length]!;
}

export function exampleCount(personas: Persona[]): number {
  return personas.reduce((n, p) => n + p.examples.length, 0);
}

/** SEO — мэргэжлийн хуудасны тайлбар */
export function personaDescription(p: Persona): string {
  const first = p.examples[0]?.request ?? "";
  return `${p.intro} Жишээ: «${first}». Хүсэлтээ бичихэд бэлэн промпт, параметр, алхам бүрийн тайлбар гарна.`;
}
