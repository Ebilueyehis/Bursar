"use client";

import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { useSetupTasks } from "@/lib/setup/useSetupTasks";
import { Card } from "@/components/ui";

/**
 * "Finish setting up" prompt on the dashboard. Renders only for admins with
 * outstanding blockers; disappears the moment every blocker is done.
 */
export function SetupCard() {
  const { role } = useViewer();
  const { state, loading } = useSetupTasks();

  if (!can(role, "edit_fees")) return null;
  if (loading || !state) return null;
  if (state.allBlockersDone || !state.nextTask) return null;

  const next = state.nextTask;
  const remaining = state.tasks.filter((t) => t.tier === "blocker" && !t.done).length;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">Finish setting up</p>
          <p className="text-sm text-ink-muted">
            {remaining} {remaining === 1 ? "step" : "steps"} left. Next: {next.title.toLowerCase()}.
          </p>
        </div>
        <span className="money shrink-0 text-lg font-bold text-primary">{state.percentage}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${state.percentage}%` }}
        />
      </div>
      <Link
        href={next.href}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
      >
        {next.title}
      </Link>
    </Card>
  );
}
