import { z } from "zod";

/**
 * Zod validation schemas for the Settings & connections API routes.
 * Shared between route handlers (input validation) and the lib/connections
 * business-logic functions (typed input).
 */

export const wordPressConnectionSchema = z.object({
  url: z.string().trim().url("Enter a valid URL, e.g. https://example.com"),
  username: z.string().trim().min(1, "Username is required").max(200),
  appPassword: z.string().trim().min(1, "Application password is required"),
});
export type WordPressConnectionInput = z.infer<
  typeof wordPressConnectionSchema
>;

export const wordPressTestSchema = z.object({
  url: z.string().trim().url().optional(),
  username: z.string().trim().max(200).optional(),
  appPassword: z.string().trim().optional(),
});
export type WordPressTestInput = z.infer<typeof wordPressTestSchema>;

export const instagramConnectionSchema = z.object({
  accessToken: z.string().trim().min(1, "Access token is required"),
  businessAccountId: z
    .string()
    .trim()
    .min(1, "Business account ID is required"),
  igUsername: z.string().trim().max(200).optional(),
});
export type InstagramConnectionInput = z.infer<
  typeof instagramConnectionSchema
>;

export const instagramTestSchema = z.object({
  accessToken: z.string().trim().optional(),
  businessAccountId: z.string().trim().optional(),
});
export type InstagramTestInput = z.infer<typeof instagramTestSchema>;

export const brandSettingsSchema = z.object({
  name: z.string().trim().max(200).default(""),
  logoUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
  primaryColor: z.string().trim().min(1).max(20),
  secondaryColor: z.string().trim().min(1).max(20),
  textColor: z.string().trim().min(1).max(20),
  backgroundColor: z.string().trim().min(1).max(20),
  fontFamily: z.string().trim().min(1).max(100),
  handle: z.string().trim().max(200).optional().or(z.literal("")),
});
export type BrandSettingsInput = z.infer<typeof brandSettingsSchema>;

export interface WordPressConnectionSafe {
  id: string;
  url: string;
  username: string;
  appPasswordMasked: string;
  createdAt: Date;
}

export interface InstagramConnectionSafe {
  id: string;
  businessAccountId: string;
  igUsername: string | null;
  accessTokenMasked: string;
  createdAt: Date;
}

export interface ConnectionTestResult {
  ok: boolean;
  error?: string;
}

export interface WordPressTestResult extends ConnectionTestResult {
  siteName?: string;
}

export interface InstagramTestResult extends ConnectionTestResult {
  username?: string;
}
