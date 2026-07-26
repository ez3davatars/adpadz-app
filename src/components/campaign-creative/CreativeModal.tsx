import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { AdpadzButton } from "../adpadz-ui";

type CreativeModalProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  fullViewport?: boolean;
};

export default function CreativeModal({
  open,
  title,
  eyebrow,
  description,
  onClose,
  closeLabel,
  toolbar,
  children,
  footer,
  fullViewport = false,
}: CreativeModalProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => dialogRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-0 backdrop-blur-md sm:p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="creative-modal-title"
        aria-describedby={description ? "creative-modal-description" : undefined}
        tabIndex={-1}
        onKeyDown={event => trapFocus(event, dialogRef.current, onClose)}
        className={`${fullViewport ? "h-[100dvh] w-screen rounded-none" : "h-[100dvh] w-screen rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-3xl"} flex flex-col overflow-hidden border border-white/10 bg-[var(--bg-base)] shadow-2xl`}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neon">{eyebrow}</p>}
            <h2 id="creative-modal-title" className="truncate text-base font-black sm:text-lg">{title}</h2>
            {description && <p id="creative-modal-description" className="mt-0.5 text-[10px] text-[var(--text-muted)]">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            <AdpadzButton type="button" variant="icon" size="sm" aria-label={closeLabel ?? `Close ${title}`} onClick={onClose}>
              <X className="h-4 w-4" />
            </AdpadzButton>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">{children}</div>
        {footer && <footer className="border-t border-white/10 p-4">{footer}</footer>}
      </section>
    </div>
  );
}

type CreativeConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export function CreativeConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: CreativeConfirmDialogProps) {
  return (
    <CreativeModal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AdpadzButton type="button" variant="secondary" onClick={onCancel}>Keep current creative</AdpadzButton>
          <AdpadzButton type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</AdpadzButton>
        </div>
      )}
    >
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4 text-sm leading-relaxed text-amber-50">
        Nothing is saved until you choose <strong>Save Creative</strong>.
      </div>
    </CreativeModal>
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null, onClose: () => void) {
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
