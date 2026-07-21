import "server-only";

import { db } from "@/lib/db";
import type { BrandSettings } from "@/types/carousel";

import type { BrandSettingsInput } from "./schemas";

export async function saveBrandSettings(
  userId: string,
  input: BrandSettingsInput
): Promise<BrandSettings> {
  const data = {
    name: input.name,
    logoUrl: input.logoUrl || null,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    textColor: input.textColor,
    backgroundColor: input.backgroundColor,
    fontFamily: input.fontFamily,
    handle: input.handle || null,
  };

  const setting = await db.brandSetting.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return toBrandSettings(setting);
}

export async function getBrandSettings(
  userId: string
): Promise<BrandSettings | null> {
  const setting = await db.brandSetting.findUnique({ where: { userId } });
  return setting ? toBrandSettings(setting) : null;
}

function toBrandSettings(setting: {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  handle: string | null;
}): BrandSettings {
  return {
    name: setting.name,
    logoUrl: setting.logoUrl ?? undefined,
    primaryColor: setting.primaryColor,
    secondaryColor: setting.secondaryColor,
    textColor: setting.textColor,
    backgroundColor: setting.backgroundColor,
    fontFamily: setting.fontFamily,
    handle: setting.handle ?? undefined,
  };
}
