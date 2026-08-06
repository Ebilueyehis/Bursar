import { describe, it, expect } from "vitest";
import { dismissalKey, readDismissed, addDismissed } from "@/lib/setup/dismissal";

function fakeStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

describe("dismissal store", () => {
  it("keys by user id", () => {
    expect(dismissalKey("u-1")).toBe("bursar-setup-dismissed:u-1");
  });
  it("reads empty when nothing stored or JSON is bad", () => {
    expect(readDismissed(fakeStore(), "u-1")).toEqual([]);
    expect(readDismissed(fakeStore({ "bursar-setup-dismissed:u-1": "not json" }), "u-1")).toEqual([]);
  });
  it("adds a nudge id without duplicating and persists it", () => {
    const store = fakeStore();
    const after = addDismissed(store, "u-1", "staff");
    expect(after).toEqual(["staff"]);
    expect(addDismissed(store, "u-1", "staff")).toEqual(["staff"]);
    expect(readDismissed(store, "u-1")).toEqual(["staff"]);
  });
  it("ignores unknown ids read back from storage", () => {
    expect(readDismissed(fakeStore({ "bursar-setup-dismissed:u-1": '["staff","bogus"]' }), "u-1"))
      .toEqual(["staff"]);
  });
});
