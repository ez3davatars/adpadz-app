import { useEffect, type KeyboardEvent, type RefObject } from "react";

/**
 * Shared modal-surface behavior for every Creative Workshop overlay
 * (modal, history drawer, mobile inspector sheet). One implementation of
 * focus trapping, body scroll locking, initial focus, and focus restore.
 */

export function trapDialogFocus(
  event: KeyboardEvent,
  container: HTMLElement | null,
  onClose: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hasAttribute("hidden"));
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (document.activeElement === container) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

type DialogBehaviorOptions = {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Optional element id that should receive initial focus instead of the container. */
  initialFocusId?: string;
};

export function useDialogBehavior({ active, containerRef, initialFocusId }: DialogBehaviorOptions) {
  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const target = initialFocusId ? document.getElementById(initialFocusId) : null;
      (target ?? containerRef.current)?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [active, containerRef, initialFocusId]);
}
