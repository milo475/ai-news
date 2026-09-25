import Link from "next/link";
import { signOut } from "@/auth/config";
import { currentUser } from "@/auth/session";
import { UserMenu } from "./UserMenu";

/** Header-ийн баруун тал: нэвтрээгүй бол «Нэвтрэх», нэвтэрсэн бол хэрэглэгчийн цэс */
export async function AuthNav() {
  const user = await currentUser();

  if (!user) {
    return (
      <Link
        href="/nevtreh"
        className="text-sm rounded border border-line px-3 py-1.5 hover:bg-line/40 whitespace-nowrap"
      >
        Нэвтрэх
      </Link>
    );
  }

  return (
    <UserMenu
      name={user.name ?? null}
      email={user.email}
      image={user.image ?? null}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
}
