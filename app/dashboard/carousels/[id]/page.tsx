import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CarouselEditor } from "@/components/dashboard/carousel-editor/carousel-editor";
import { NowCarouselEditor } from "@/components/dashboard/now-carousel-editor/now-carousel-editor";
import { slidesSchema } from "@/lib/carousel-schema";
import { CarouselNotFoundError, getCarouselForUser } from "@/lib/carousels";
import { getInstagramConnection } from "@/lib/connections/instagram";
import {
  nowStoredSlidesSchema,
  parseNowTemplateId,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import { isTemplateId, TEMPLATE_IDS } from "@/templates";

interface CarouselEditorPageProps {
  params: Promise<{ id: string }>;
}

/** Shown when Carousel.slides can't be parsed — for either slide shape. */
function CorruptedCarouselNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <p className="text-sm font-medium">Deze carousel is beschadigd.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        De opgeslagen slide-data kon niet worden gelezen. Neem contact op
        met support of verwijder deze carousel vanaf het overzicht.
      </p>
    </div>
  );
}

export default async function CarouselEditorPage({
  params,
}: CarouselEditorPageProps) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;

  let carousel;
  try {
    carousel = await getCarouselForUser(id, userId);
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      notFound();
    }
    throw error;
  }

  // Two editors behind one route, mirroring POST /api/render's split: a
  // `now:<family>` carousel stores manifest-token slides and gets the NOW
  // editor; everything else keeps the satori path below untouched.
  const nowFamily = parseNowTemplateId(carousel.template);
  if (nowFamily) {
    const nowSlides = nowStoredSlidesSchema.safeParse(carousel.slides);
    if (!nowSlides.success) {
      return <CorruptedCarouselNotice />;
    }

    const instagramConnection = await getInstagramConnection(userId);

    return (
      <NowCarouselEditor
        initial={{
          id: carousel.id,
          family: nowFamily,
          slides: nowSlides.data as NowStoredSlide[],
          caption: carousel.caption,
          hashtags: carousel.hashtags,
          status: carousel.status,
          instagramId: carousel.instagramId,
        }}
        article={{
          id: carousel.article.id,
          title: carousel.article.title,
          imageUrl: carousel.article.imageUrl,
        }}
        instagramUsername={instagramConnection?.igUsername ?? null}
      />
    );
  }

  const slidesResult = slidesSchema.safeParse(carousel.slides);
  if (!slidesResult.success) {
    return <CorruptedCarouselNotice />;
  }

  // Should always be one of TEMPLATE_IDS in practice (every write path
  // validates against templateIdSchema) — falls back defensively so a
  // stale/corrupt value never crashes the editor page outright.
  const template = isTemplateId(carousel.template)
    ? carousel.template
    : TEMPLATE_IDS[0];

  // Only needed for the "view on Instagram" fallback link (settings page
  // already reads/renders this connection in full) — null if not connected.
  const instagramConnection = await getInstagramConnection(userId);

  return (
    <CarouselEditor
      initial={{
        id: carousel.id,
        template,
        slides: slidesResult.data,
        caption: carousel.caption,
        hashtags: carousel.hashtags,
        status: carousel.status,
        instagramId: carousel.instagramId,
      }}
      article={{
        id: carousel.article.id,
        title: carousel.article.title,
        imageUrl: carousel.article.imageUrl,
      }}
      instagramUsername={instagramConnection?.igUsername ?? null}
    />
  );
}
