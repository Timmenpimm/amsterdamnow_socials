import type { CSSProperties } from "react";

import type { Slide } from "@/types/carousel";

import { FONT_FAMILY, parseListItems, resolveBrand } from "./shared";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideMeta, type SlideTemplate } from "./types";

/**
 * minimal-business — quiet, editorial-adjacent whitespace look. Lots of
 * margin, hairline rules, a single restrained accent touch per slide.
 */

const MARGIN = 88;
const FOOTER_HEIGHT = 76;

const base: CSSProperties = {
  fontFamily: FONT_FAMILY,
  display: "flex",
};

function Progress({ index, total, color }: { index: number; total: number; color: string }) {
  if (total > 10) {
    return (
      <span style={{ fontSize: 20, fontWeight: 400, color: "#9a9a9a", letterSpacing: 1 }}>
        {index + 1} / {total}
      </span>
    );
  }

  return (
    <div style={{ ...base, gap: 10, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            ...base,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === index ? color : "#e2e2e2",
          }}
        />
      ))}
    </div>
  );
}

function Footer({
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
        height: FOOTER_HEIGHT,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: "1px solid #ececec",
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: "#8a8a8a", letterSpacing: 3 }}>
        {(brand.handle ?? brand.name ?? "").toUpperCase()}
      </span>
      <Progress index={meta.index} total={meta.total} color={brand.primaryColor} />
    </div>
  );
}

function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ ...base, alignItems: "center", gap: 14 }}>
      <div style={{ ...base, width: 32, height: 2, backgroundColor: color }} />
      <span style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: 3 }}>
        {text.toUpperCase()}
      </span>
    </div>
  );
}

function renderHero(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);
  const imageHeight = 620;

  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 72,
        gap: 40,
      }}
    >
      <div
        style={{
          ...base,
          width: SLIDE_WIDTH - MARGIN * 2,
          height: imageHeight,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#f2f2f2",
        }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.imageUrl}
            alt={slide.headline}
            width={SLIDE_WIDTH - MARGIN * 2}
            height={imageHeight}
            style={{ objectFit: "cover" }}
          />
        )}
      </div>
      <div style={{ ...base, flexDirection: "column", gap: 20 }}>
        <Kicker text={brand.name || "Highlight"} color={brand.primaryColor} />
        <span
          style={{
            fontSize: 58,
            lineHeight: 1.15,
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
        marginTop: 220,
        gap: 32,
      }}
    >
      <Kicker text={brand.name || "Achtergrond"} color={brand.primaryColor} />
      <span style={{ fontSize: 64, lineHeight: 1.15, fontWeight: 700, color: brand.textColor }}>
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 30, lineHeight: 1.6, fontWeight: 400, color: "#5f5f5f" }}>
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
        marginTop: 140,
        gap: 36,
      }}
    >
      <Kicker text={brand.name || "Overzicht"} color={brand.primaryColor} />
      <span style={{ fontSize: 50, lineHeight: 1.2, fontWeight: 700, color: brand.textColor }}>
        {slide.headline}
      </span>
      <div style={{ ...base, flexDirection: "column", marginTop: 12 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              ...base,
              alignItems: "center",
              gap: 28,
              paddingTop: 24,
              paddingBottom: 24,
              borderTop: i === 0 ? "1px solid #ececec" : "none",
              borderBottom: "1px solid #ececec",
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 700, color: brand.primaryColor }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 28, lineHeight: 1.4, fontWeight: 400, color: brand.textColor }}>
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
        alignItems: "center",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 260,
        gap: 40,
        textAlign: "center",
      }}
    >
      <div style={{ ...base, width: 48, height: 2, backgroundColor: brand.primaryColor }} />
      <span
        style={{
          fontSize: 48,
          lineHeight: 1.35,
          fontWeight: 700,
          color: brand.textColor,
        }}
      >
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 24, fontWeight: 400, color: "#8a8a8a", letterSpacing: 1 }}>
          {slide.body.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function renderImage(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);
  const imageHeight = 980;

  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 72,
        gap: 28,
      }}
    >
      <div
        style={{
          ...base,
          width: SLIDE_WIDTH - MARGIN * 2,
          height: imageHeight,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#f2f2f2",
        }}
      >
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.imageUrl}
            alt={slide.headline}
            width={SLIDE_WIDTH - MARGIN * 2}
            height={imageHeight}
            style={{ objectFit: "cover" }}
          />
        )}
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, color: brand.textColor }}>{slide.headline}</span>
    </div>
  );
}

function renderCta(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  return (
    <div
      style={{
        ...base,
        flexDirection: "column",
        alignItems: "center",
        width: SLIDE_WIDTH - MARGIN * 2,
        marginLeft: MARGIN,
        marginRight: MARGIN,
        marginTop: 300,
        gap: 32,
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 52, lineHeight: 1.25, fontWeight: 700, color: brand.textColor }}>
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 28, fontWeight: 400, color: "#6b6b6b" }}>{slide.body}</span>
      )}
      <div
        style={{
          ...base,
          marginTop: 20,
          alignItems: "center",
          border: `2px solid ${brand.primaryColor}`,
          borderRadius: 999,
          paddingLeft: 44,
          paddingRight: 44,
          paddingTop: 18,
          paddingBottom: 18,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 700, color: brand.primaryColor }}>
          {brand.handle ?? brand.name ?? "Meer info"}
        </span>
      </div>
    </div>
  );
}

export const minimalBusinessTemplate: SlideTemplate = (slide, brandSettings, meta) => {
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
        justifyContent: "space-between",
        backgroundColor: brand.backgroundColor,
        color: brand.textColor,
        overflow: "hidden",
      }}
    >
      {content}
      <Footer brand={brand} meta={meta} />
    </div>
  );
};

export default minimalBusinessTemplate;
