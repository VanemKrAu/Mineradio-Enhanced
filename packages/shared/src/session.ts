import { z } from "zod";
import { ProviderIdSchema } from "./provider";

export const ProviderSessionCookieAckSchema = z
  .object({
    provider: ProviderIdSchema,
    stored: z.boolean(),
  })
  .strict();

export type ProviderSessionCookieAck = z.infer<typeof ProviderSessionCookieAckSchema>;

export const ProviderVipIconSchema = z.enum([
  "netease-vip",
  "netease-svip",
  "qq-green-vip",
  "qq-super-vip",
]);

export type ProviderVipIcon = z.infer<typeof ProviderVipIconSchema>;

export const ProviderLoginStatusSchema = z
  .object({
    provider: ProviderIdSchema,
    loggedIn: z.boolean(),
    nickname: z.string().optional(),
    avatarUrl: z.string().optional(),
    userId: z.string().optional(),
    vipType: z.number().optional(),
    vipLevel: z.enum(["none", "vip", "svip"]).optional(),
    isVip: z.boolean().optional(),
    isSvip: z.boolean().optional(),
    vipLabel: z.string().optional(),
    vipIcon: ProviderVipIconSchema.optional(),
    vipIconUrl: z.string().optional(),
    vipTier: z.number().int().nonnegative().optional(),
    vipLevelName: z.string().optional(),
  })
  .strict();

export type ProviderLoginStatus = z.infer<typeof ProviderLoginStatusSchema>;

export const ProviderLogoutAckSchema = z
  .object({
    provider: ProviderIdSchema,
    loggedOut: z.boolean(),
  })
  .strict();

export type ProviderLogoutAck = z.infer<typeof ProviderLogoutAckSchema>;

export const ProviderLoginQrKeySchema = z
  .object({
    provider: ProviderIdSchema,
    key: z.string().min(1),
  })
  .strict();

export type ProviderLoginQrKey = z.infer<typeof ProviderLoginQrKeySchema>;

export const ProviderLoginQrImageSchema = z
  .object({
    provider: ProviderIdSchema,
    key: z.string().min(1),
    img: z.string().min(1),
    url: z.string().optional(),
  })
  .strict();

export type ProviderLoginQrImage = z.infer<typeof ProviderLoginQrImageSchema>;

export const ProviderLoginQrCheckSchema = z
  .object({
    provider: ProviderIdSchema,
    key: z.string().min(1),
    code: z.number(),
    message: z.string().optional(),
    loggedIn: z.boolean(),
    scanned: z.boolean().optional(),
    expired: z.boolean().optional(),
    stored: z.boolean().optional(),
  })
  .strict();

export type ProviderLoginQrCheck = z.infer<typeof ProviderLoginQrCheckSchema>;
