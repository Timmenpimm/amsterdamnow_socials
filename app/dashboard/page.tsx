import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-16 sm:px-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session?.user?.email}
          </p>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
