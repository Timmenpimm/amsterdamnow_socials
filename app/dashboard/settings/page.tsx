import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { WordPressConnectionForm } from "@/components/dashboard/wordpress-connection-form";
import { InstagramConnectionForm } from "@/components/dashboard/instagram-connection-form";
import { BrandSettingsSection } from "@/components/dashboard/brand-settings-section";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Settings"
        description="Beheer je WordPress- en Instagram-verbinding en merkinstellingen."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WordPressConnectionForm />
        <InstagramConnectionForm />
        <BrandSettingsSection />
      </div>
    </div>
  );
}
