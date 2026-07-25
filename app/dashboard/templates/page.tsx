import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { UploadedTemplatesSection } from "@/components/dashboard/uploaded-templates-section";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TEMPLATE_METADATA_LIST } from "@/lib/template-metadata";
import { NOW_TEMPLATE_MANIFEST } from "@/templates/now/manifest";

/** "hotspot" -> "Hotspot", "cta" -> "CTA" — nette labels voor manifest-waarden. */
function formatManifestLabel(value: string): string {
  if (value === "cta") return "CTA";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TemplatesPage() {
  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Templates"
        description="Upload je eigen HTML-templates of gebruik de ingebouwde formats voor je carousels."
      />

      <UploadedTemplatesSection />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Ingebouwde templates</h2>
          <p className="text-sm text-muted-foreground">
            Standaardformats die met de renderer worden meegeleverd.
          </p>
        </div>

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
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Amsterdam NOW-templates</h2>
          <p className="text-sm text-muted-foreground">
            Vaste slide-ontwerpen uit de design-handoff, per carousel-familie.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {NOW_TEMPLATE_MANIFEST.map((spec) => (
            <Card key={`${spec.family}-${spec.slideType}`} className="gap-3 py-4">
              <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">
                    {formatManifestLabel(spec.family)} —{" "}
                    {formatManifestLabel(spec.slideType)}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0">
                    Ingebouwd
                  </Badge>
                </div>
                <CardDescription className="flex flex-col gap-0.5 text-xs">
                  <span>
                    {spec.dimensions.width} × {spec.dimensions.height} px
                  </span>
                  <span className="font-mono">{spec.file}</span>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
