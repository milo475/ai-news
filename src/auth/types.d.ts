/**
 * Auth.js-ийн session/JWT-д нэмсэн талбарууд.
 */
import type { UserRole } from "../generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      /** Имэйл баталгаажсан эсэх — бичих үйлдэлд шаардана (Auth.js-ийн emailVerified нь Date тул өөр нэр) */
      verified: boolean;
    };
  }

  interface User {
    role?: UserRole;
    emailVerified?: boolean | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: UserRole;
    verified?: boolean;
  }
}

export {};
