/**
 * Instagram carousel limits (per Meta's Graph API docs), shared between the
 * server-only publish client (lib/instagram.ts) and the generator plans
 * (lib/now-carousel.ts, lib/openai.ts). Lives in its own module because
 * lib/instagram.ts is "server-only" while lib/now-carousel.ts is also
 * imported by client components.
 */
export const MIN_CAROUSEL_SLIDES = 2;
export const MAX_CAROUSEL_SLIDES = 10;
