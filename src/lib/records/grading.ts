export const ASSESSMENT_MAXES = { ca1: 20, ca2: 20, exam: 60 } as const;

/** WAEC-style scale, highest threshold first. */
export const GRADE_SCALE: { min: number; grade: string }[] = [
  { min: 70, grade: "A" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 45, grade: "D" },
  { min: 40, grade: "E" },
  { min: 0, grade: "F" },
];

/** Sum of components; null only when all three are null. Nulls count as 0. */
export function componentTotal(
  ca1: number | null,
  ca2: number | null,
  exam: number | null,
): number | null {
  if (ca1 == null && ca2 == null && exam == null) return null;
  return (ca1 ?? 0) + (ca2 ?? 0) + (exam ?? 0);
}

export function gradeFor(total: number | null): string | null {
  if (total == null) return null;
  for (const band of GRADE_SCALE) {
    if (total >= band.min) return band.grade;
  }
  return "F";
}
