import { describe, expect, it } from "vitest";
import { getSafeAuthDestination, isRecoveryRequest } from "./authRedirect";

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
  it("recognizes password recovery callbacks", () => {
    expect(isRecoveryRequest("?recovery=1")).toBe(true);
    expect(isRecoveryRequest("", "#type=recovery&access_token=redacted")).toBe(true);
    expect(isRecoveryRequest("?next=%2Fapp%2Fbusiness%2Fdashboard")).toBe(false);
  });
});
