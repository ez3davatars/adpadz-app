import { afterEach, describe, expect, it, vi } from "vitest";
import {
  waitForCreativeFonts,
  waitForCreativeImage,
  waitForCreativeResource,
} from "../creativeResourceWait";

afterEach(() => {
  vi.useRealTimers();
});

describe("creative browser resource waits", () => {
  it("fails closed when fonts do not settle before the deadline", async () => {
    vi.useFakeTimers();
    const pending = new Promise<void>(() => undefined);
    const result = waitForCreativeFonts(
      { ready: pending },
      "Creative fonts timed out; export stopped.",
      25,
    );

    const assertion = expect(result).rejects.toThrow(
      "Creative fonts timed out; export stopped.",
    );
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it("clears the timeout when a generic resource settles", async () => {
    vi.useFakeTimers();
    await expect(waitForCreativeResource(
      Promise.resolve("ready"),
      "Resource timed out.",
      25,
    )).resolves.toBe("ready");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes image listeners and fails closed when image loading stalls", async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, EventListener>();
    const image = {
      complete: false,
      naturalWidth: 0,
      addEventListener: vi.fn((name: string, listener: EventListener) => {
        listeners.set(name, listener);
      }),
      removeEventListener: vi.fn((name: string) => {
        listeners.delete(name);
      }),
    } as unknown as HTMLImageElement;
    const result = waitForCreativeImage(image, {
      failureMessage: "Image failed.",
      timeoutMessage: "Image timed out; candidate generation stopped.",
      timeoutMs: 25,
    });

    const assertion = expect(result).rejects.toThrow(
      "Image timed out; candidate generation stopped.",
    );
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(listeners.size).toBe(0);
    expect(image.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it("closes the cached-image race after registering listeners", async () => {
    let completeChecks = 0;
    const image = {
      get complete() {
        completeChecks += 1;
        return completeChecks > 1;
      },
      naturalWidth: 320,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLImageElement;

    await expect(waitForCreativeImage(image, {
      failureMessage: "Image failed.",
      timeoutMessage: "Image timed out.",
      timeoutMs: 25,
    })).resolves.toBeUndefined();
    expect(image.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it("preserves the immediate image failure instead of waiting for timeout", async () => {
    const image = {
      complete: true,
      naturalWidth: 0,
    } as HTMLImageElement;

    await expect(waitForCreativeImage(image, {
      failureMessage: "Image failed.",
      timeoutMessage: "Image timed out.",
      timeoutMs: 25,
    })).rejects.toThrow("Image failed.");
  });
});
