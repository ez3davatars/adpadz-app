export const CREATIVE_RESOURCE_WAIT_TIMEOUT_MS = 15_000;

type CreativeImageWaitOptions = {
  failureMessage: string;
  timeoutMessage: string;
  timeoutMs?: number;
};

export async function waitForCreativeFonts(
  fonts: { ready: PromiseLike<unknown> } | null | undefined,
  timeoutMessage: string,
  timeoutMs = CREATIVE_RESOURCE_WAIT_TIMEOUT_MS,
) {
  if (!fonts) return;
  await waitForCreativeResource(
    Promise.resolve(fonts.ready),
    timeoutMessage,
    timeoutMs,
  );
}

export function waitForCreativeImage(
  image: HTMLImageElement,
  {
    failureMessage,
    timeoutMessage,
    timeoutMs = CREATIVE_RESOURCE_WAIT_TIMEOUT_MS,
  }: CreativeImageWaitOptions,
): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(failureMessage));
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(failureMessage));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, normalizeTimeout(timeoutMs));

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    // Close the complete-check/listener-registration race for cached images.
    if (image.complete) {
      if (image.naturalWidth > 0) handleLoad();
      else handleError();
    }
  });
}

export function waitForCreativeResource<T>(
  resource: PromiseLike<T>,
  timeoutMessage: string,
  timeoutMs = CREATIVE_RESOURCE_WAIT_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(timeoutMessage)),
      normalizeTimeout(timeoutMs),
    );
    Promise.resolve(resource).then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      error => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function normalizeTimeout(value: number) {
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : CREATIVE_RESOURCE_WAIT_TIMEOUT_MS;
}
