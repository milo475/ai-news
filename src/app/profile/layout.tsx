import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { Avatar } from "@/components/Avatar";
import { ProfileTabs } from "@/components/ProfileTabs";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/nevtreh?ur=%2Fprofile");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Avatar email={user.email} name={user.name} image={user.image} size={48} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{user.name ?? user.email}</h1>
          <p className="text-xs text-muted truncate">
            {user.email}
            {!user.verified && <span className="text-warn"> · баталгаажаагүй</span>}
          </p>
        </div>
        <Link href="/medee" className="ml-auto text-sm text-muted hover:text-ink whitespace-nowrap">
          Мэдээ →
        </Link>
      </div>

      <ProfileTabs />
      {children}
    </div>
  );
}
