import { z } from "zod";

export const storySchema = z.object({
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarifications: z.array(z.string()),
  status: z.literal("draft"),
  suggestedEpic: z.string().optional()
});

export const generatedStoriesSchema = z.object({
  stories: z.array(storySchema)
});

export type GeneratedStory = z.infer<typeof storySchema>;
export type GeneratedStories = z.infer<typeof generatedStoriesSchema>;
