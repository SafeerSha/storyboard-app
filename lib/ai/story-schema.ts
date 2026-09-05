import { z } from "zod";

export const generatedStorySchema = z.object({
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarifications: z.array(z.string()),
  status: z.literal("draft"),
  suggestedEpic: z.string().optional()
});

export type GeneratedStory = z.infer<typeof generatedStorySchema>;
