import type { School } from "@/lib/domain/types";

export type SetupTaskId = "fees" | "students" | "bank" | "staff" | "vendors";

export interface SetupTask {
  id: SetupTaskId;
  title: string;
  why: string;
  tier: "blocker" | "nudge";
  done: boolean;
  weight: number;
  href: string;
  dismissible: boolean;
}

export interface SetupState {
  tasks: SetupTask[];
  percentage: number;
  nextTask: SetupTask | null;
  allBlockersDone: boolean;
}

export interface DeriveSetupInput {
  /** Distinct class levels the school currently has (from its classes). */
  classLevels: string[];
  /** Distinct levels that have at least one fee item for the term. */
  feeLevels: string[];
  studentCount: number;
  bankComplete: boolean;
  dismissedNudges: SetupTaskId[];
  /** Vendors nudge only shows once M4 ships. Default off. */
  includeVendors?: boolean;
}

const BLOCKER_WEIGHT = 3;
const NUDGE_WEIGHT = 1;

/** All three bank fields present and non-blank. */
export function isBankComplete(
  school: Pick<School, "bankAccountNumber" | "bankAccountName" | "bankName"> | null,
): boolean {
  if (!school) return false;
  return (
    !!school.bankAccountNumber?.trim() &&
    !!school.bankAccountName?.trim() &&
    !!school.bankName?.trim()
  );
}

/**
 * Fees are "done" when there is a fee structure that covers the school.
 * If the school already has classes, every class level must have fee items.
 * If it has no classes yet, any fee item counts (they set fees before classes).
 */
function feesDone(classLevels: string[], feeLevels: string[]): boolean {
  if (feeLevels.length === 0) return false;
  if (classLevels.length === 0) return true;
  const covered = new Set(feeLevels);
  return classLevels.every((l) => covered.has(l));
}

export function deriveSetupTasks(input: DeriveSetupInput): SetupState {
  const dismissed = new Set(input.dismissedNudges);
  const fees = feesDone(input.classLevels, input.feeLevels);
  const students = input.studentCount > 0;
  const bank = input.bankComplete;

  const tasks: SetupTask[] = [
    {
      id: "fees",
      title: "Set up your fee structure",
      why: "Bills need a fee list for every class.",
      tier: "blocker",
      done: fees,
      weight: BLOCKER_WEIGHT,
      href: "/profile",
      dismissible: false,
    },
    {
      id: "students",
      title: "Add your first student",
      why: "You need at least one student to record a payment.",
      tier: "blocker",
      done: students,
      weight: BLOCKER_WEIGHT,
      href: "/students/new",
      dismissible: false,
    },
    {
      id: "bank",
      title: "Add your bank account details",
      why: "Shown on every invoice and receipt so parents pay the right account.",
      tier: "blocker",
      done: bank,
      weight: BLOCKER_WEIGHT,
      href: "/profile",
      dismissible: false,
    },
    {
      id: "staff",
      title: "Invite your staff",
      why: "Add teachers and bursars if others will help run Bursar.",
      tier: "nudge",
      done: dismissed.has("staff"),
      weight: NUDGE_WEIGHT,
      href: "/profile",
      dismissible: true,
    },
  ];

  if (input.includeVendors) {
    tasks.push({
      id: "vendors",
      title: "Add your vendors",
      why: "Track suppliers and their due dates alongside salaries.",
      tier: "nudge",
      done: dismissed.has("vendors"),
      weight: NUDGE_WEIGHT,
      href: "/expenses",
      dismissible: true,
    });
  }

  const shownWeight = tasks.reduce((s, t) => s + t.weight, 0);
  const doneWeight = tasks.reduce((s, t) => s + (t.done ? t.weight : 0), 0);
  const percentage = Math.round((doneWeight / shownWeight) * 100);

  const blockers = tasks.filter((t) => t.tier === "blocker");
  const nextTask = blockers.find((t) => !t.done) ?? null;
  const allBlockersDone = blockers.every((t) => t.done);

  return { tasks, percentage, nextTask, allBlockersDone };
}
