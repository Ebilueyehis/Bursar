"use client";

import { useEffect, useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import {
  deriveSetupTasks,
  isBankComplete,
  type SetupState,
  type SetupTaskId,
} from "@/lib/setup/setupTasks";
import { addDismissed, readDismissed } from "@/lib/setup/dismissal";

/**
 * Single source of truth for the setup checklist. Fetches its own school (not
 * viewer.school) so the bank blocker refreshes when the panel is re-opened
 * after saving. Nudge dismissal is per-user localStorage.
 */
export function useSetupTasks(): {
  state: SetupState | null;
  loading: boolean;
  dismiss: (id: SetupTaskId) => void;
} {
  const { term, userId } = useViewer();
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const { data: feeItems } = useAsync(() => repository.listFeeItems(term), [term]);
  const { data: students } = useAsync(() => repository.listStudents(), []);
  const { data: school } = useAsync(() => repository.getSchool(), []);

  const [dismissed, setDismissed] = useState<SetupTaskId[]>([]);
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    setDismissed(readDismissed(window.localStorage, userId));
  }, [userId]);

  const loading =
    classes == null || feeItems == null || students == null || school == null;

  const state = useMemo<SetupState | null>(() => {
    if (loading) return null;
    const classLevels = Array.from(new Set(classes!.map((c) => c.level)));
    const feeLevels = Array.from(new Set(feeItems!.map((f) => f.level)));
    return deriveSetupTasks({
      classLevels,
      feeLevels,
      studentCount: students!.length,
      bankComplete: isBankComplete(school!),
      dismissedNudges: dismissed,
    });
  }, [loading, classes, feeItems, students, school, dismissed]);

  function dismiss(id: SetupTaskId) {
    if (!userId || typeof window === "undefined") return;
    setDismissed(addDismissed(window.localStorage, userId, id));
  }

  return { state, loading, dismiss };
}
