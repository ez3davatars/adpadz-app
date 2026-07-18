import { describe, expect, it } from "vitest";
import { getSafeAuthDestination } from "./authRedirect";

describe("authentication return destinations", () => {
  it("returns customers to an internal booking page", () => {
    expect(
      getSafeAuthDestination(
        "?next=%2Fcommunity-cards%2Fnorth-hills-fall",
      ),
    ).toBe("/community-cards/north-hills-fall");
  });

  it.each([
    ["", "/app/business/dashboard"],
    ["?next=https%3A%2F%2Fevil.example", "/app/business/dashboard"],
    ["?next=%2F%2Fevil.example", "/app/business/dashboard"],
  ])("falls back safely for %s", (search, expected) => {
    expect(getSafeAuthDestination(search)).toBe(expected);
  });
});
