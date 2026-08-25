import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}));

const { requirePlatformAdmin } = await import("./guard");

describe("requirePlatformAdmin", () => {
  beforeEach(() => {
    getUser.mockReset();
    maybeSingle.mockReset();
  });

  it("throws when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requirePlatformAdmin()).rejects.toThrow("Not signed in.");
  });

  it("throws when the signed-in user has no platform_admins row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    maybeSingle.mockResolvedValue({ data: null });
    await expect(requirePlatformAdmin()).rejects.toThrow("Not authorised.");
  });

  it("resolves with the caller's id when they are on the allowlist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    maybeSingle.mockResolvedValue({ data: { id: "u1" } });
    await expect(requirePlatformAdmin()).resolves.toEqual({ id: "u1" });
  });
});
