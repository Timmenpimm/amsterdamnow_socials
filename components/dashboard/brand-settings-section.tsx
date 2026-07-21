import { Palette } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BrandSettingsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Merkinstellingen</CardTitle>
        <CardDescription>
          Logo, kleuren en lettertype voor je carousel-templates. Beschikbaar
          zodra de renderer is gebouwd.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <Palette className="size-4 shrink-0" />
          Binnenkort beschikbaar
        </div>
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}
