import { FileText, Globe } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export default function PostsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Posts"
        description="Geïmporteerde WordPress-artikelen die klaar zijn om om te zetten naar een carousel."
        action={
          <Button disabled>
            <Globe />
            Verbind WordPress
          </Button>
        }
      />

      <EmptyState
        icon={FileText}
        title="Nog geen artikelen geïmporteerd"
        description="Verbind een WordPress-website via Settings om je eerste artikelen te importeren."
      />
    </div>
  );
}
