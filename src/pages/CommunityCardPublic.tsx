import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lock, ShoppingBag } from "lucide-react";
import { supabase } from "../lib/supabase";
import { AdpadzButton, AdpadzCard } from "../components/adpadz-ui";
import CommunityMailerCanvas from "../components/community-mailer/CommunityMailerCanvas";
import CommunityMailerLegend from "../components/community-mailer/CommunityMailerLegend";
import CommunityMailerSideTabs from "../components/community-mailer/CommunityMailerSideTabs";
import {
  type CommunityCardRecord,
  formatCurrency,
} from "../lib/communityCards";
import type {
  CommunityMailerRenderRecord,
  LayoutPlacement,
} from "../lib/communityMailerLayout";

type PublicMailer =
  & CommunityMailerRenderRecord
  & Pick<
    CommunityCardRecord,
    | "public_slug"
    | "layout_key"
    | "mailing_date"
    | "household_count"
    | "status"
    | "is_published"
  >;
type Payload = { mailer?: PublicMailer; placements?: LayoutPlacement[] };
export default function CommunityCardPublic() {
  const { slug } = useParams(),
    [card, setCard] = useState<PublicMailer>(),
    [slots, setSlots] = useState<LayoutPlacement[]>([]);
  const [selected, setSelected] = useState<string[]>([]),
    [side, setSide] = useState<"front" | "back">("front");
  const [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const fetchMailer = useCallback(async (keepExisting = false) => {
    const { data, error } = await supabase.rpc("get_public_community_mailer", {
      p_public_slug: slug,
    });
    const payload = data as Payload | null;
    if (error || !payload?.mailer) {
      if (!keepExisting) {
        setLoadError("This community mailer is not currently available.");
      } else {setMessage(
          "The reservation succeeded, but the latest layout could not be refreshed. Reload the page to see current availability.",
        );}
      return false;
    }
    setCard(payload.mailer);
    setSlots(payload.placements || []);
    return true;
  }, [slug]);
  useEffect(() => {
    void (async () => {
      await fetchMailer();
      setLoading(false);
    })();
  }, [fetchMailer]);
  const available = useMemo(
    () => slots.filter((slot) => slot.status === "available"),
    [slots],
  );
  const selectedSlots = useMemo(
    () => slots.filter((slot) => selected.includes(slot.id)),
    [slots, selected],
  );
  const total = selectedSlots.reduce((sum, slot) => sum + slot.price_cents, 0);
  function toggle(slot: LayoutPlacement) {
    if (slot.status !== "available") return;
    setSelected((current) =>
      current.includes(slot.id)
        ? current.filter((id) => id !== slot.id)
        : current.length === 2
        ? current
        : [...current, slot.id]
    );
  }
  async function reserve() {
    if (!card || !selected.length) return;
    setMessage("");
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      window.location.href = `/auth?next=${
        encodeURIComponent(`/community-cards/${slug}`)
      }`;
      return;
    }
    const { error } = await supabase.rpc("reserve_community_card_spaces", {
      p_card_id: card.id,
      p_slot_ids: selected,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      "Your space is held. Checkout will be enabled when the secure payment connection is activated.",
    );
    setSelected([]);
    await fetchMailer(true);
  }
  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg-base)] p-6 text-center text-white">
        <AdpadzCard className="max-w-md p-8">
          <h1 className="text-xl font-black">Community Mailer</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{loadError}</p>
        </AdpadzCard>
      </main>
    );
  }
  if (loading || !card) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg-base)] text-sm text-[var(--text-muted)]">
        Loading community mailer...
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-neon">
              Adpadz Community Mailer
            </p>
            <h1 className="mt-1 text-3xl font-black">{card.title}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {card.zone_name || "Mailing zone pending"} / {available.length}
              {" "}
              spaces available /{" "}
              {card.household_count?.toLocaleString() || "--"} homes
            </p>
          </div>
          <Link to="/">
            <span className="font-black text-neon">adpadz.co</span>
          </Link>
        </header>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CommunityMailerSideTabs side={side} onChange={setSide} />
              <CommunityMailerLegend />
            </div>
            <CommunityMailerCanvas
              mailer={card}
              placements={slots}
              side={side}
              mode="public-booking"
              bookingSelection={selected}
              onSelect={toggle}
            />
            <p className="text-center text-xs text-[var(--text-muted)]">
              Select an available position directly on the mailer. Occupied
              spaces only show advertiser creative when that business has
              approved public display.
            </p>
          </section>
          <aside>
            <AdpadzCard className="sticky top-5 p-5">
              <div className="flex items-center gap-2 text-neon">
                <ShoppingBag className="h-5 w-5" />
                <b>Choose your ad space</b>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Choose one or two available placements. Size, side, position,
                and price come directly from this campaign.
              </p>
              <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                {slots.filter((slot) => slot.side === side).map((slot) => {
                  const chosen = selected.includes(slot.id),
                    open = slot.status === "available";
                  return (
                    <button
                      key={slot.id}
                      disabled={!open}
                      onClick={() => toggle(slot)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${
                        chosen
                          ? "border-neon bg-neon/15"
                          : open
                          ? "border-white/15 hover:border-neon/50"
                          : "cursor-not-allowed border-white/5 bg-white/[.03] opacity-55"
                      }`}
                    >
                      <span>
                        <b>{open ? slot.label : "Occupied placement"}</b>
                        <small className="mt-1 block text-xs text-[var(--text-muted)]">
                          {open
                            ? `${slot.placement_type} / ${slot.width}% x ${slot.height}% of side`
                            : "Not available"}
                        </small>
                      </span>
                      {open
                        ? (chosen
                          ? <CheckCircle2 className="h-5 w-5 text-neon" />
                          : (
                            <span className="font-black text-neon">
                              {formatCurrency(slot.price_cents)}
                            </span>
                          ))
                        : <Lock className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex justify-between text-sm">
                  <span>{selected.length} of 2 spaces selected</span>
                  <b className="text-neon">{formatCurrency(total)}</b>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Pricing is locked from the selected campaign inventory.
                </p>
                <AdpadzButton
                  fullWidth
                  className="mt-3"
                  disabled={!selected.length || !card.sales_open}
                  onClick={() => void reserve()}
                >
                  {card.sales_open
                    ? (
                      <>
                        <span>Continue to checkout</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )
                    : "Sales are currently closed"}
                </AdpadzButton>
                {message && (
                  <p role="status" className="mt-3 text-xs text-neon">
                    {message}
                  </p>
                )}
              </div>
            </AdpadzCard>
          </aside>
        </div>
      </div>
    </main>
  );
}
