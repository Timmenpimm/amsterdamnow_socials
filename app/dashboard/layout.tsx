import Link from "next/link";

import { auth } from "@/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border px-4 py-6 sm:flex">
        <Link href="/dashboard/posts" className="px-3 pb-8 text-lg font-semibold">
          Amsterdam NOW
        </Link>
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <LogoutButton />
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
