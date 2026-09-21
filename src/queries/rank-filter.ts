/**
 * Жагсаалтын шүүлтийн дүрэм (DB-гүй, тесттэй).
 *
 * arenaOnly модель нь зөвхөн LMArena-д байдаг — OpenRouter-т байхгүй тул
 * хэрэглээний жагсаалтад хэзээ ч орохгүй.
 */
import type { RankSource } from "../generated/prisma/enums";

export function leaderboardWhere(source: RankSource): {
  source: RankSource;
  model?: { arenaOnly: boolean };
} {
  return source === "OPENROUTER_USAGE" ? { source, model: { arenaOnly: false } } : { source };
}
