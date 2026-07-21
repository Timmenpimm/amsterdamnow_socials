import { Images } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CarouselCard } from "@/components/dashboard/carousel-card";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { listCarouselsForUser } from "@/lib/carousels";
import { slidesSchema } from "@/lib/carousel-schema";

export default async function CarouselsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const carousels = await listCarouselsForUser(userId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Carousels"
        description="Gegenereerde Instagram-carousels op basis van je geïmporteerde artikelen."
      />

      {carousels.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Nog geen carousels gegenereerd"
          description="Zodra je artikelen hebt geïmporteerd, kun je hier carousels genereren en bekijken."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {carousels.map((carousel) => {
            // slides is untyped Json in the DB; count leniently (fall back
            // to a raw array length) so a card never crashes the whole grid
            // over one malformed carousel — the editor page validates
            // strictly and surfaces a real error there instead.
            const parsedSlides = slidesSchema.safeParse(carousel.slides);
            const slideCount = parsedSlides.success
              ? parsedSlides.data.length
              : Array.isArray(carousel.slides)
                ? carousel.slides.length
                : 0;

            return (
              <CarouselCard
                key={carousel.id}
                id={carousel.id}
                articleTitle={carousel.article.title}
                articleImageUrl={carousel.article.imageUrl}
                template={carousel.template}
                status={carousel.status}
                slideCount={slideCount}
                createdAt={carousel.createdAt}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
