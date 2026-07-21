import type { CSSProperties } from "react";

import type { Slide } from "@/types/carousel";

import { FONT_FAMILY, parseListItems, resolveBrand } from "./shared";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideMeta, type SlideTemplate } from "./types";

/**
 * magazine — editorial cover-page energy: oversized type, a masthead rule,
 * and an image caption card that overlaps the photo like a print spread.
 */

const MARGIN = 72;
const MASTHEAD_HEIGHT = 108;

const base: CSSProperties = {
  fontFamily: FONT_FAMILY,
  display: "flex",
};

function Masthead({
  brand,
  meta,
}: {
  brand: ReturnType<typeof resolveBrand>;
  meta: SlideMeta;
}) {
  return (
    <div
      style={{
        ...base,
        width: SLIDE_WIDTH - MARGIN * 2,
        height: MASTHEAD_HEIGHT,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `3px solid ${brand.textColor}`,
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: brand.textColor,
          letterSpacing: 4,
        }}
      >
        {(brand.name || "MAGAZINE").toUpperCase()}
      </span>
      <span style={{ fontSize: 24, fontWeight: 400, color: brand.primaryColor, letterSpacing: 2 }}>
        No. {String(meta.index + 1).padStart(2, "0")} / {String(meta.total).padStart(2, "0")}
      </span>
    </div>
  );
}

function renderHero(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);
  const imageHeight = 760;

  return (
    <div style={{ ...base, flexDirection: "column", width: SLIDE_WIDTH }}>
      <div
        style={{
          ...base,
          width: SLIDE_WIDTH,
          height: imageHeight,
          backgroundColor: "#e5e5e5",
        }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.imageUrl}
            alt={slide.headline}
            width={SLIDE_WIDTH}
            height={imageHeight}
            style={{ objectFit: "cover" }}
          />
        )}
      </div>
      <div
        style={{
          ...base,
          flexDirection: "column",
          width: SLIDE_WIDTH - MARGIN * 2,
          marginLeft: MARGIN,
          marginRight: MARGIN,
          marginTop: -64,
          backgroundColor: brand.backgroundColor,
          padding: 40,
          gap: 16,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color: brand.primaryColor, letterSpacing: 3 }}>
          FEATURE
        </span>
        <span
          style={{
            fontSize: 68,
            lineHeight: 1.05,
            fontWeight: 700,
            color: brand.textColor,
          }}
        >
          {slide.headline}
        </span>
      </div>
    </div>
  );
}

function renderText(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 100,
        gap: 36,
      }}
    >
      <span
        style={{
          fontSize: 88,
          lineHeight: 1.02,
          fontWeight: 700,
          color: brand.textColor,
          letterSpacing: -1,
        }}
      >
        {slide.headline}
      </span>
      <div style={{ ...base, width: 96, height: 6, backgroundColor: brand.primaryColor }} />
      {slide.body && (
        <span style={{ fontSize: 32, lineHeight: 1.6, fontWeight: 400, color: brand.textColor, opacity: 0.8 }}>
          {slide.body}
        </span>
      )}
    </div>
  );
}

function renderList(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  const items = parseListItems(slide.body);

  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 64,
        gap: 28,
      }}
    >
      <span style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 700, color: brand.textColor }}>
        {slide.headline}
      </span>
      <div style={{ ...base, flexDirection: "column", marginTop: 20 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              ...base,
              alignItems: "flex-start",
              gap: 24,
              paddingTop: 26,
              paddingBottom: 26,
              borderTop: `1px solid ${brand.textColor}33`,
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: brand.primaryColor,
                opacity: 0.35,
                lineHeight: 1,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: 30,
                lineHeight: 1.45,
                fontWeight: 400,
                color: brand.textColor,
                paddingTop: 8,
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderQuote(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 160,
        gap: 28,
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -90,
          left: -12,
          fontSize: 260,
          fontWeight: 700,
          color: brand.primaryColor,
          opacity: 0.15,
          lineHeight: 1,
        }}
      >
        &rdquo;
      </span>
      <span
        style={{
          fontSize: 58,
          lineHeight: 1.3,
          fontWeight: 700,
          color: brand.textColor,
        }}
      >
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 26, fontWeight: 700, color: brand.primaryColor, letterSpacing: 2 }}>
          — {slide.body.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function renderImage(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);

  return (
    <div style={{ ...base, width: SLIDE_WIDTH, height: SLIDE_HEIGHT - MASTHEAD_HEIGHT, position: "relative" }}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt={slide.headline}
          width={SLIDE_WIDTH}
          height={SLIDE_HEIGHT - MASTHEAD_HEIGHT}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            ...base,
            position: "absolute",
            top: 0,
            left: 0,
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT - MASTHEAD_HEIGHT,
            backgroundColor: "#e5e5e5",
          }}
        />
      )}
      <div
        style={{
          ...base,
          position: "absolute",
          left: 0,
          bottom: 0,
          width: SLIDE_WIDTH,
          backgroundColor: "rgba(0,0,0,0.55)",
          paddingLeft: MARGIN,
          paddingRight: MARGIN,
          paddingTop: 28,
          paddingBottom: 28,
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 700, color: "#ffffff" }}>{slide.headline}</span>
      </div>
    </div>
  );
}

function renderCta(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        width: SLIDE_WIDTH - MARGIN * 2,
        height: SLIDE_HEIGHT - MASTHEAD_HEIGHT,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        backgroundColor: brand.textColor,
        gap: 28,
      }}
    >
      <div style={{ ...base, width: 96, height: 6, backgroundColor: brand.primaryColor }} />
      <span
        style={{
          fontSize: 72,
          lineHeight: 1.08,
          fontWeight: 700,
          color: brand.backgroundColor,
        }}
      >
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 28, fontWeight: 400, color: brand.backgroundColor, opacity: 0.8 }}>
          {slide.body}
        </span>
      )}
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: brand.primaryColor,
          letterSpacing: 3,
          marginTop: 12,
        }}
      >
        {(brand.handle ?? brand.name ?? "").toUpperCase()}
      </span>
    </div>
  );
}

export const magazineTemplate: SlideTemplate = (slide, brandSettings, meta) => {
  const brand = resolveBrand(brandSettings);

  let content: React.ReactNode;
  switch (slide.layout) {
    case "hero":
      content = renderHero(slide, brand, meta);
      break;
    case "list":
      content = renderList(slide, brand);
      break;
    case "quote":
      content = renderQuote(slide, brand);
      break;
    case "image":
      content = renderImage(slide, brand, meta);
      break;
    case "cta":
      content = renderCta(slide, brand);
      break;
    case "text":
    default:
      content = renderText(slide, brand);
      break;
  }

  return (
    <div
      style={{
        ...base,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        flexDirection: "column",
        backgroundColor: brand.backgroundColor,
        color: brand.textColor,
        overflow: "hidden",
      }}
    >
      <Masthead brand={brand} meta={meta} />
      {content}
    </div>
  );
};

export default magazineTemplate;
