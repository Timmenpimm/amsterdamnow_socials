import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TEMPLATE_METADATA_LIST } from "@/lib/template-metadata";

export default function TemplatesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Templates"
        description="Kies het visuele format waarin je carousels worden gerenderd."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_METADATA_LIST.map((template) => (
          <Card key={template.id}>
            <div className="mx-6 aspect-[4/5] rounded-md bg-muted" />
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                Binnenkort beschikbaar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
