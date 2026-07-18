const items = [["available", "Available"], ["reserved", "Held"], [
  "sold",
  "Sold",
], ["creative", "Creative ready"]];
export default function CommunityMailerLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] font-bold text-[var(--text-secondary)]">
      {items.map(([tone, label]) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <i
            className={`h-2.5 w-2.5 rounded-full ${
              tone === "available"
                ? "bg-white/30"
                : tone === "reserved"
                ? "bg-amber-300"
                : tone === "sold"
                ? "bg-neon"
                : "bg-sky-400"
            }`}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
