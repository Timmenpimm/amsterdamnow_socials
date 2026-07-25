import { NextResponse } from "next/server";

import { resolveApiUserId } from "@/lib/api-auth";
import { NOW_FAMILY_PLANS, nowTemplateId } from "@/lib/now-carousel";
import { getNowTemplateSpec } from "@/templates/now/manifest";

export const runtime = "nodejs";

/**
 * GET /api/templates/now
 *
 * Publishes the Amsterdam NOW carousel structure — families, slide order and
 * the placeholder specs per slide — so other apps (the artikel-tool) can build
 * their template picker and slide editor without duplicating the manifest.
 */
export async function GET(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const families = NOW_FAMILY_PLANS.map((plan) => ({
    family: plan.family,
    templateId: nowTemplateId(plan.family),
    label: plan.label,
    purpose: plan.purpose,
    minSlides: plan.steps.reduce((total, step) => total + step.min, 0),
    maxSlides: plan.steps.reduce((total, step) => total + step.max, 0),
    steps: plan.steps.map((step) => {
      const spec = getNowTemplateSpec(plan.family, step.slideType);
      return {
        slideType: step.slideType,
        min: step.min,
        max: step.max,
        dimensions: spec.dimensions,
        placeholders: spec.placeholders.map((placeholder) => ({
          name: placeholder.name,
          description: placeholder.description,
          isUrl: placeholder.isUrl ?? false,
          enumValues: placeholder.enumValues ?? null,
          zeroPadTo: placeholder.zeroPadTo ?? null,
          allowsLineBreak: placeholder.allowsLineBreak ?? false,
        })),
      };
    }),
  }));

  return NextResponse.json({ families });
}
