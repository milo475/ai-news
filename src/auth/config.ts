/**
 * Auth.js (next-auth v5) тохиргоо.
 *
 * Session: JWT, 30 хоног. Prisma adapter нь хэрэглэгч/OAuth бүртгэлийг хадгална.
 * Credentials provider нь JWT шаарддаг тул database session хэрэглэхгүй.
 *
 * Google нь GOOGLE_CLIENT_ID/SECRET байвал л идэвхжинэ — эс бөгөөс товч ч харагдахгүй.
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "../db";
import { googleEnabled, SESSION_MAX_AGE } from "./config.api";
import { verifyPassword } from "./password";
import { linkSubscriber } from "./users";

export { googleEnabled, GENERIC_LOGIN_ERROR } from "./config.api";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/nevtreh", error: "/nevtreh" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await verifyPassword(password, user.passwordHash))) return null;

        // role/emailVerified нь jwt callback дотор DB-ээс уншигдана (Adapter-ийн
        // User төрөл emailVerified-ийг Date гэж тодорхойлдог тул энд тавихгүй)
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    ...(googleEnabled()
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (!token.uid) return token;

      // Хүсэлт бүрт DB-ээс уншина: эрх, баталгаажилт шууд шинэчлэгдэх ба
      // «бүх төхөөрөмжөөс гарах» (sessionVersion) тэр даруй үйлчилнэ.
      const db = await prisma.user.findUnique({
        where: { id: String(token.uid) },
        select: { role: true, emailVerifiedAt: true, name: true, image: true, sessionVersion: true },
      });
      // Хэрэглэгч устсан эсвэл бүх session хүчингүй болсон
      if (!db) return null;
      if (typeof token.sv === "number" && token.sv !== db.sessionVersion) return null;

      token.role = db.role;
      token.verified = db.emailVerifiedAt !== null;
      token.name = db.name;
      token.picture = db.image;
      token.sv = db.sessionVersion;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
        session.user.verified = Boolean(token.verified);
      }
      return session;
    },
  },
  events: {
    /** Google-ээр анх нэвтрэхэд имэйл баталгаажсанд тооцож, newsletter бүртгэлтэй холбоно */
    async createUser({ user }) {
      if (!user.email) return;
      await prisma.user.update({
        where: { id: user.id! },
        data: { emailVerifiedAt: new Date() },
      });
      await linkSubscriber(user.id!, user.email);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
