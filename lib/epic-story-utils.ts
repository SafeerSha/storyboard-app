import type { Epic, Story } from "@/lib/types";

/**
 * Sorts epics strictly by created_at DESC (newest first).
 * Requirement: ALL users must see epics in the same order (created_at DESC).
 */
export function sortEpics<T extends { created_at?: string | null }>(epics: T[]): T[] {
  return [...epics].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Sorts stories strictly by updated_at DESC, with a stable secondary created_at DESC / id DESC.
 */
export function sortStories<T extends { updated_at?: string | null; created_at?: string | null; id?: string }>(
  stories: T[]
): T[] {
  return [...stories].sort((a, b) => {
    const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (updatedB !== updatedA) {
      return updatedB - updatedA;
    }
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (createdB !== createdA) {
      return createdB - createdA;
    }
    return (b.id || "").localeCompare(a.id || "");
  });
}

export interface EpicGroup<TEpic, TStory> {
  id: string;
  name: string;
  description?: string | null;
  epic: TEpic | null;
  isUncategorized: boolean;
  stories: TStory[];
  storyCount: number;
}

/**
 * Groups stories into Epic folders preserving:
 * 1. Epic ordering: created_at DESC (newest first)
 * 2. Story ordering: updated_at DESC, created_at DESC
 * 3. Empty epics are preserved with storyCount = 0
 * 4. Stories with epic_id = null are grouped under 'Uncategorized' at the end
 */
export function groupStoriesByEpic<
  TEpic extends { id: string; name: string; created_at?: string | null; description?: string | null },
  TStory extends { id: string; epic_id?: string | null; updated_at?: string | null; created_at?: string | null }
>(epics: TEpic[], stories: TStory[]): EpicGroup<TEpic, TStory>[] {
  const sortedEpics = sortEpics(epics);
  const sortedAllStories = sortStories(stories);

  // Group stories by epic_id
  const epicStoriesMap = new Map<string, TStory[]>();
  const uncategorizedStories: TStory[] = [];

  for (const story of sortedAllStories) {
    if (!story.epic_id) {
      uncategorizedStories.push(story);
    } else {
      const existing = epicStoriesMap.get(story.epic_id);
      if (existing) {
        existing.push(story);
      } else {
        epicStoriesMap.set(story.epic_id, [story]);
      }
    }
  }

  // Build groups for real epics
  const groups: EpicGroup<TEpic, TStory>[] = sortedEpics.map((epic) => {
    const epicStories = epicStoriesMap.get(epic.id) || [];
    return {
      id: epic.id,
      name: epic.name,
      description: epic.description,
      epic,
      isUncategorized: false,
      stories: epicStories,
      storyCount: epicStories.length,
    };
  });

  // Append Uncategorized group if any exist
  if (uncategorizedStories.length > 0) {
    groups.push({
      id: "uncategorized",
      name: "Uncategorized",
      description: "Requirements not assigned to an Epic",
      epic: null,
      isUncategorized: true,
      stories: uncategorizedStories,
      storyCount: uncategorizedStories.length,
    });
  }

  return groups;
}
