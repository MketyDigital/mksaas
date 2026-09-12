import { z } from 'zod';

import { platformOverviewSectionSchema } from './schemas';

const publicPageAdminSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(180),
    seoTitle: z.string().min(1).max(160),
    seoDescription: z.string().min(1).max(320),
    eyebrow: z.string().min(1).max(80),
    headline: z.string().min(1).max(220),
    intro: z.string().min(1).max(900),
    sections: z.array(platformOverviewSectionSchema).min(1),
  })
  .strict();

export const publicPagesAdminPayloadSchema = z
  .object({
    pages: z.array(publicPageAdminSchema).min(1),
  })
  .strict();

export type PublicPagesAdminPayload = z.infer<typeof publicPagesAdminPayloadSchema>;
