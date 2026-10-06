"use client";

import { useState, useEffect, useCallback } from "react";

export type RequirementsViewMode = "hierarchy" | "kanban";

const SESSION_STORAGE_KEY = "storyboard_requirements_view_mode";

/**
 * Custom hook to manage and persist the user's preferred view selection
 * ("hierarchy" standard tree view vs "kanban" board view) within the session.
 */
export function useRequirementsViewPreference(
  defaultMode: RequirementsViewMode = "hierarchy"
): [RequirementsViewMode, (mode: RequirementsViewMode) => void] {
  const [viewMode, setViewModeState] = useState<RequirementsViewMode>(defaultMode);

  // Safely restore preferred view from sessionStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored === "kanban" || stored === "hierarchy") {
          setViewModeState(stored);
        }
      }
    } catch {
      // Graceful fallback if storage is disabled
    }
  }, []);

  // Update state and write to sessionStorage
  const setViewMode = useCallback((mode: RequirementsViewMode) => {
    setViewModeState(mode);
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, mode);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  return [viewMode, setViewMode];
}
