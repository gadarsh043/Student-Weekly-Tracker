import { useEffect, useCallback, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Hook that guards against losing unsaved changes.
 *
 * Handles three navigation vectors:
 *  1. React Router link/navigate (useBlocker)
 *  2. Browser tab close / refresh (beforeunload)
 *  3. In-page actions (team switch, week switch) via confirmOrRun()
 *
 * @param {boolean} isDirty - Whether there are unsaved changes
 * @returns {{ blocker, confirmOrRun }}
 */
export function useUnsavedChanges(isDirty) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // 1. Block React Router navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  // 2. Block browser tab close / refresh
  useEffect(() => {
    const handler = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // 3. Guard for in-page navigation (team switch, week switch, etc.)
  //    Returns true if safe to proceed, false if user cancelled.
  const confirmOrRun = useCallback(
    (action) => {
      if (!dirtyRef.current) {
        action();
        return;
      }
      const ok = window.confirm(
        "You have unsaved changes. Discard them and continue?"
      );
      if (ok) action();
    },
    []
  );

  return { blocker, confirmOrRun };
}
