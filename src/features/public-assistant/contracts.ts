import { z } from 'zod';

export const publicAssistantMessageSchema = z
  .object({
    conversationId: z.uuid().optional(),
    message: z.string().trim().min(1).max(2000),
  })
  .strict();

export const publicAssistantDeleteSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('all') }).strict(),
  z
    .object({
      scope: z.literal('conversation'),
      conversationId: z.uuid(),
    })
    .strict(),
]);

export type PublicAssistantMessageInput = z.infer<typeof publicAssistantMessageSchema>;
export type PublicAssistantDeleteInput = z.infer<typeof publicAssistantDeleteSchema>;
