/**
 * Class ordering for a Nigerian school: Creche (low) to SSS 3 (high). Used to
 * sort student tables by class and to derive the Primary / Secondary level.
 */
export function classRank(label: string): number {
  const s = (label || "").toLowerCase();
  const n = parseInt((s.match(/\d+/) ?? ["0"])[0], 10) || 0;
  if (s.includes("creche")) return 0;
  if (s.includes("nursery")) return 1 + n;
  if (s.includes("kg") || s.includes("recept")) return 5 + n;
  if (s.includes("basic") || s.includes("primary")) return 10 + n;
  if (s.includes("jss")) return 20 + n;
  if (s.includes("sss") || s.includes("ss")) return 30 + n;
  return 99;
}

export type ClassLevel = "Primary" | "Secondary";

/** JSS and up is Secondary; Creche through Basic/Primary is Primary. */
export function classLevel(label: string): ClassLevel {
  return classRank(label) >= 20 && classRank(label) < 99 ? "Secondary" : "Primary";
}
