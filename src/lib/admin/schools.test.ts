import { describe, expect, it, vi } from "vitest";

vi.mock("./guard", () => ({
  requirePlatformAdmin: async () => ({ id: "admin-1" }),
}));

const schoolsRows = [
  { id: "s1", name: "Trinity Jubilee", code: "TJH", created_at: "2026-01-05T00:00:00Z" },
  { id: "s2", name: "No Students Yet Academy", code: "NSY", created_at: "2026-02-01T00:00:00Z" },
];
const studentRows = [{ school_id: "s1" }, { school_id: "s1" }, { school_id: "s1" }];
const paymentRows = [
  { school_id: "s1", created_at: "2026-08-01T10:00:00Z" },
  { school_id: "s1", created_at: "2026-08-20T10:00:00Z" },
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "schools") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: schoolsRows, error: null }),
          }),
        };
      }
      if (table === "students") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: studentRows }),
          }),
        };
      }
      if (table === "payments") {
        return {
          select: () => Promise.resolve({ data: paymentRows }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { listSchoolsForAdmin } = await import("./schools");

describe("listSchoolsForAdmin", () => {
  it("computes active student count and last payment per school, without either metric throwing when a school has none", async () => {
    const rows = await listSchoolsForAdmin();

    const s1 = rows.find((r) => r.id === "s1")!;
    expect(s1.activeStudents).toBe(3);
    expect(s1.lastPaymentAt).toBe("2026-08-20T10:00:00Z");

    const s2 = rows.find((r) => r.id === "s2")!;
    expect(s2.activeStudents).toBe(0);
    expect(s2.lastPaymentAt).toBeNull();
  });
});
