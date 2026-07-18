import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { AdpadzCard } from "../adpadz-ui";
import { DEMO_MAILER_PRODUCTION_SCENARIOS } from "../../lib/demoCommunityMailerProduction";

export default function DemoCommunityMailerProduction() {
  const [selected, setSelected] = useState<string>(
    DEMO_MAILER_PRODUCTION_SCENARIOS[0][0],
  );
  const scenario = DEMO_MAILER_PRODUCTION_SCENARIOS.find((item) =>
    item[0] === selected
  )!;
  return (
    <AdpadzCard variant="flat" className="mb-6 rounded-3xl p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">
            Fictional production fixture
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-black">
            <Mail className="h-5 w-5" />Community Mailer Production
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Interactive local-only states. No production data or claims.
          </p>
        </div>
        <select
          aria-label="Fictional production scenario"
          className="input-field sm:max-w-64"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {DEMO_MAILER_PRODUCTION_SCENARIOS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 rounded-2xl border border-neon/15 bg-neon/[.04] p-4">
        <p className="flex items-center gap-2 text-sm font-black">
          <CheckCircle2 className="h-4 w-4 text-neon" />{scenario[1]}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{scenario[2]}</p>
        <p className="mt-3 text-[10px] font-bold uppercase text-[var(--text-muted)]">
          Demo mailer · Demo Zone · revision {selected === "candidate_stale" ? 7 : 8}
        </p>
      </div>
    </AdpadzCard>
  );
}
