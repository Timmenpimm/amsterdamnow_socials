import type { CSSProperties } from "react";

import type { Slide } from "@/types/carousel";

import { formatPageCounter, FONT_FAMILY, parseListItems, resolveBrand } from "./shared";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideMeta, type SlideTemplate } from "./types";

/**
 * modern-news — punchy breaking-news look: big bold headlines, a hard
 * accent bar, dark image overlays, numbered footer. Loud on purpose.
 */

const ACCENT_BAR_HEIGHT = 14;
const FOOTER_HEIGHT = 96;
const CONTENT_HEIGHT = SLIDE_HEIGHT - FOOTER_HEIGHT - ACCENT_BAR_HEIGHT;

const base: CSSProperties = {
  fontFamily: FONT_FAMILY,
  display: "flex",
};

function Footer({ brand, meta }: { brand: ReturnType<typeof resolveBrand>; meta?: SlideMeta }) {
  return (
    <div
      style={{
        ...base,
        width: SLIDE_WIDTH,
        height: FOOTER_HEIGHT,
        backgroundColor: brand.secondaryColor,
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 56,
        paddingRight: 56,
        marginTop: "auto",
      }}
    >
      <div style={{ ...base, fontSize: 26, fontWeight: 700, color: "#ffffff" }}>
        {brand.handle ?? brand.name ?? ""}
      </div>
      {meta && (
        <div style={{ ...base, fontSize: 24, fontWeight: 400, color: "#ffffff", opacity: 0.75 }}>
          {formatPageCounter(meta.index, meta.total)}
        </div>
      )}
    </div>
  );
}

function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        ...base,
        alignItems: "center",
        backgroundColor: color,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <span style={{ fontSize: 26, fontWeight: 700, color: "#ffffff", letterSpacing: 2 }}>
        {text.toUpperCase()}
      </span>
    </div>
  );
}

function renderHero(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);

  return (
    <div style={{ ...base, width: SLIDE_WIDTH, height: CONTENT_HEIGHT, position: "relative" }}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt={slide.headline}
          width={SLIDE_WIDTH}
          height={CONTENT_HEIGHT}
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
            height: CONTENT_HEIGHT,
            backgroundColor: brand.secondaryColor,
          }}
        />
      )}
      <div
        style={{
          ...base,
          position: "absolute",
          top: 0,
          left: 0,
          width: SLIDE_WIDTH,
          height: CONTENT_HEIGHT,
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.05) 75%)",
        }}
      />
      <div
        style={{
          ...base,
          position: "absolute",
          left: 0,
          bottom: 0,
          width: SLIDE_WIDTH,
          flexDirection: "column",
          gap: 24,
          padding: 56,
        }}
      >
        <Kicker text={brand.name || "Nieuws"} color={brand.primaryColor} />
        <span
          style={{
            fontSize: 76,
            lineHeight: 1.08,
            fontWeight: 700,
            color: "#ffffff",
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
    <div style={{ ...base, width: SLIDE_WIDTH, height: CONTENT_HEIGHT, padding: 64 }}>
      <div
        style={{
          ...base,
          width: 10,
          backgroundColor: brand.primaryColor,
          marginRight: 40,
        }}
      />
      <div style={{ ...base, flexDirection: "column", gap: 28, flex: 1 }}>
        <Kicker text={brand.name || "Nieuws"} color={brand.primaryColor} />
        <span style={{ fontSize: 66, lineHeight: 1.1, fontWeight: 700 }}>{slide.headline}</span>
        {slide.body && (
          <span style={{ fontSize: 32, lineHeight: 1.5, fontWeight: 400, opacity: 0.85 }}>
            {slide.body}
          </span>
        )}
      </div>
    </div>
  );
}

function renderList(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  const items = parseListItems(slide.body);

  return (
    <div
      style={{
        ...base,
        width: SLIDE_WIDTH,
        height: CONTENT_HEIGHT,
        flexDirection: "column",
        padding: 64,
        gap: 32,
      }}
    >
      <Kicker text={brand.name || "Nieuws"} color={brand.primaryColor} />
      <span style={{ fontSize: 52, lineHeight: 1.15, fontWeight: 700 }}>{slide.headline}</span>
      <div style={{ ...base, flexDirection: "column", gap: 22, marginTop: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ ...base, alignItems: "flex-start", gap: 20 }}>
            <div
              style={{
                ...base,
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: 24,
                backgroundColor: brand.primaryColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 700, color: "#ffffff" }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: 30, lineHeight: 1.4, fontWeight: 400, paddingTop: 6 }}>
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
        width: SLIDE_WIDTH,
        height: CONTENT_HEIGHT,
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        gap: 24,
      }}
    >
      <span style={{ fontSize: 140, fontWeight: 700, color: brand.primaryColor, lineHeight: 1 }}>
        &ldquo;
      </span>
      <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.25 }}>{slide.headline}</span>
      {slide.body && (
        <div style={{ ...base, alignItems: "center", gap: 16, marginTop: 12 }}>
          <div style={{ ...base, width: 48, height: 4, backgroundColor: brand.primaryColor }} />
          <span style={{ fontSize: 28, fontWeight: 400, opacity: 0.75 }}>{slide.body}</span>
        </div>
      )}
    </div>
  );
}

function renderImage(slide: Slide, brand: ReturnType<typeof resolveBrand>, meta: SlideMeta) {
  const hasImage = Boolean(meta.imageUrl);

  return (
    <div style={{ ...base, width: SLIDE_WIDTH, height: CONTENT_HEIGHT, position: "relative" }}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt={slide.headline}
          width={SLIDE_WIDTH}
          height={CONTENT_HEIGHT}
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
            height: CONTENT_HEIGHT,
            backgroundColor: brand.secondaryColor,
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
          backgroundColor: "rgba(0,0,0,0.78)",
          padding: 40,
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 36, fontWeight: 700, color: "#ffffff", lineHeight: 1.25 }}>
          {slide.headline}
        </span>
        {slide.body && (
          <span style={{ fontSize: 24, fontWeight: 400, color: "#ffffff", opacity: 0.8 }}>
            {slide.body}
          </span>
        )}
      </div>
    </div>
  );
}

function renderCta(slide: Slide, brand: ReturnType<typeof resolveBrand>) {
  return (
    <div
      style={{
        ...base,
        width: SLIDE_WIDTH,
        height: CONTENT_HEIGHT,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: brand.primaryColor,
        padding: 80,
        gap: 32,
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 64, fontWeight: 700, color: "#ffffff", lineHeight: 1.15 }}>
        {slide.headline}
      </span>
      {slide.body && (
        <span style={{ fontSize: 32, fontWeight: 400, color: "#ffffff", opacity: 0.9 }}>
          {slide.body}
        </span>
      )}
      <div
        style={{
          ...base,
          marginTop: 16,
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderRadius: 999,
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 18,
          paddingBottom: 18,
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 700, color: brand.primaryColor }}>
          {brand.handle ?? brand.name ?? "Volg voor meer"}
        </span>
      </div>
    </div>
  );
}

export const modernNewsTemplate: SlideTemplate = (slide, brandSettings, meta) => {
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
        position: "relative",
        backgroundColor: brand.backgroundColor,
        color: brand.textColor,
        overflow: "hidden",
      }}
    >
      <div style={{ ...base, width: SLIDE_WIDTH, height: ACCENT_BAR_HEIGHT, backgroundColor: brand.primaryColor }} />
      <div style={{ ...base, width: SLIDE_WIDTH, height: CONTENT_HEIGHT, position: "relative", overflow: "hidden" }}>
        {content}
      </div>
      <Footer brand={brand} meta={meta} />
    </div>
  );
};

export default modernNewsTemplate;
