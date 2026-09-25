/**
 * Профайлын "Долоо хоногийн имэйл" сонголтыг Subscriber хүснэгттэй синк хийнэ.
 *
 * Тус хүснэгт нь имэйлийн жагсаалтын цорын ганц эх — нэвтрээгүй захиалагчид ч энд байдаг.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../db";

export async function syncDigestEmail(userId: string, email: string, wanted: boolean): Promise<void> {
  const existing = await prisma.subscriber.findUnique({
    where: { email },
    select: { id: true, confirmedAt: true },
  });

  if (!wanted) {
    // Бүртгэлийг устгахгүй — UNSUBSCRIBED болгож түүхийг үлдээнэ
    if (existing) await prisma.subscriber.update({ where: { email }, data: { status: "UNSUBSCRIBED" } });
    return;
  }

  if (existing) {
    await prisma.subscriber.update({
      where: { email },
      data: {
        status: "ACTIVE", userId,
        // Профайлаас асаасан бол имэйл нь аль хэдийн баталгаажсан
        confirmedAt: existing.confirmedAt ?? new Date(),
        confirmToken: null,
      },
    });
    return;
  }

  await prisma.subscriber.create({
    data: {
      email, userId, status: "ACTIVE", confirmedAt: new Date(),
      unsubscribeToken: randomBytes(24).toString("hex"),
    },
  });
}
