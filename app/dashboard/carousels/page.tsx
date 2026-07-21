import { Images } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function CarouselsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Carousels"
        description="Gegenereerde Instagram-carousels op basis van je geïmporteerde artikelen."
      />

      <EmptyState
        icon={Images}
        title="Nog geen carousels gegenereerd"
        description="Zodra je artikelen hebt geïmporteerd, kun je hier carousels genereren en bekijken."
      />
    </div>
  );
}
