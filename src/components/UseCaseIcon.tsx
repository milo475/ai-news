import {
  Bot, Code, GraduationCap, Image, Languages, Laptop, MessageCircle, Mic, Music,
  PenLine, Presentation, Search, Sparkles, Video,
} from "lucide-react";

/** Seed дэх icon нэрийг компонент руу буулгана. Бүх сангаа импортлохгүйн тулд гараар. */
const ICONS = {
  bot: Bot,
  code: Code,
  "graduation-cap": GraduationCap,
  image: Image,
  languages: Languages,
  laptop: Laptop,
  "message-circle": MessageCircle,
  mic: Mic,
  music: Music,
  "pen-line": PenLine,
  presentation: Presentation,
  search: Search,
  video: Video,
} as const;

export function UseCaseIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
