import { describe, it, expect } from "vitest";
import { componentTotal, gradeFor, ASSESSMENT_MAXES } from "@/lib/records/grading";

describe("componentTotal", () => {
  it("is null when every component is null", () => {
    expect(componentTotal(null, null, null)).toBeNull();
  });
  it("treats missing components as 0 when at least one is present", () => {
    expect(componentTotal(15, null, null)).toBe(15);
    expect(componentTotal(15, 18, 50)).toBe(83);
  });
});

describe("gradeFor", () => {
  it("is null for a null total", () => {
    expect(gradeFor(null)).toBeNull();
  });
  it("maps boundaries to the WAEC scale", () => {
    expect(gradeFor(100)).toBe("A");
    expect(gradeFor(70)).toBe("A");
    expect(gradeFor(69)).toBe("B");
    expect(gradeFor(60)).toBe("B");
    expect(gradeFor(59)).toBe("C");
    expect(gradeFor(50)).toBe("C");
    expect(gradeFor(49)).toBe("D");
    expect(gradeFor(45)).toBe("D");
    expect(gradeFor(44)).toBe("E");
    expect(gradeFor(40)).toBe("E");
    expect(gradeFor(39)).toBe("F");
    expect(gradeFor(0)).toBe("F");
  });
});

describe("ASSESSMENT_MAXES", () => {
  it("sums to 100", () => {
    expect(ASSESSMENT_MAXES.ca1 + ASSESSMENT_MAXES.ca2 + ASSESSMENT_MAXES.exam).toBe(100);
  });
});
