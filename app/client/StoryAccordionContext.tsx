"use client";

import { createContext, useContext, useState } from "react";

const StoryAccordionContext = createContext<{
  openStoryId: string | null;
  setOpenStoryId: (id: string | null) => void;
} | null>(null);

export function StoryAccordionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);

  return (
    <StoryAccordionContext.Provider value={{ openStoryId, setOpenStoryId }}>
      {children}
    </StoryAccordionContext.Provider>
  );
}

export function useStoryAccordion() {
  const ctx = useContext(StoryAccordionContext);
  if (!ctx) {
    throw new Error("useStoryAccordion must be used within StoryAccordionProvider");
  }
  return ctx;
}
