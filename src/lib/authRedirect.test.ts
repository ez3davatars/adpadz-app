import { describe, expect, it } from "vitest";
import {
  getAuthSignInPath,
  getSafeAuthDestination,
  isRecoveryRequest,
} from "./authRedirect";

describe("authentication return destinations", () => {
  it("returns customers to an internal booking page", () => {
    expect(
      getSafeAuthDestination(
        "?next=%2Fcommunity-cards%2Fnorth-hills-fall",
      ),
    ).toBe("/community-cards/north-hills-fall");
  });

  it("returns business owners to a protected campaign workspace", () => {
    const destination =
      "/app/business/campaigns/30000000-0000-4000-8000-000000000001/creative?panel=qr#history";
    const signInPath = getAuthSignInPath(destination);

    expect(signInPath).toBe(
      "/auth?next=%2Fapp%2Fbusiness%2Fcampaigns%2F30000000-0000-4000-8000-000000000001%2Fcreative%3Fpanel%3Dqr%23history",
    );
    expect(
      getSafeAuthDestination(signInPath.slice(signInPath.indexOf("?"))),
    ).toBe(destination);
  });

  it.each([
    ["", "/app/business/dashboard"],
    ["?next=https%3A%2F%2Fevil.example", "/app/business/dashboard"],
    ["?next=%2F%2Fevil.example", "/app/business/dashboard"],
  ])("falls back safely for %s", (search, expected) => {
    expect(getSafeAuthDestination(search)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/\tevil.example",
    "/%09evil.example",
    "/%00evil.example",
  ])("does not build an auth return path for %s", (destination) => {
    expect(getAuthSignInPath(destination)).toBe(
      "/auth?next=%2Fapp%2Fbusiness%2Fdashboard",
    );
  });

  it.each([
    "?next=%2F%5Cevil.example",
    "?next=%2F%09evil.example",
    "?next=%2F%2500evil.example",
  ])("rejects encoded auth authority and control paths for %s", (search) => {
    expect(getSafeAuthDestination(search)).toBe(
      "/app/business/dashboard",
    );
  });

  it("recognizes password recovery callbacks", () => {
    expect(isRecoveryRequest("?recovery=1")).toBe(true);
    expect(isRecoveryRequest("", "#type=recovery&access_token=redacted")).toBe(true);
    expect(isRecoveryRequest("?next=%2Fapp%2Fbusiness%2Fdashboard")).toBe(false);
  });
});
