export default function CommunityMailerSideTabs(
  { side, onChange }: {
    side: "front" | "back";
    onChange: (side: "front" | "back") => void;
  },
) {
  return (
    <div
      className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1"
      role="tablist"
      aria-label="Mailer side"
    >
      <button
        role="tab"
        aria-selected={side === "front"}
        className={`min-h-9 rounded-lg px-4 text-xs font-black ${
          side === "front"
            ? "bg-neon text-black"
            : "text-[var(--text-secondary)]"
        }`}
        onClick={() => onChange("front")}
      >
        Front
      </button>
      <button
        role="tab"
        aria-selected={side === "back"}
        className={`min-h-9 rounded-lg px-4 text-xs font-black ${
          side === "back"
            ? "bg-neon text-black"
            : "text-[var(--text-secondary)]"
        }`}
        onClick={() => onChange("back")}
      >
        Back
      </button>
    </div>
  );
}
