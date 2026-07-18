import {
  EDDM_CENTER_BAND_HEIGHT_PERCENT,
  EDDM_CENTER_BAND_TOP_PERCENT,
  EDDM_POSTAL_BLOCK_WIDTH_PERCENT,
} from "../../lib/communityCards";
import CircularPadQR from "../qr/CircularPadQR";
export default function MailerBrandArea({
  zone,
  headline = "Support Local. Save Local.",
  side,
  format,
  qrDestination,
}: {
  zone: string | null;
  headline?: string | null;
  side: "front" | "back";
  format: "postcard_9x12" | "community_card_6x11";
  qrDestination?: string | null;
}) {
  const regionStyle = format === "postcard_9x12"
    ? {
      top: `${EDDM_CENTER_BAND_TOP_PERCENT}%`,
      height: `${EDDM_CENTER_BAND_HEIGHT_PERCENT}%`,
    }
    : undefined;
  const region = format === "postcard_9x12"
    ? ""
    : "top-[3%] h-[28%]";
  return (
    <div
      style={regionStyle}
      className={`absolute left-[.75%] right-[.75%] z-20 flex items-center justify-between overflow-hidden rounded-sm bg-[#102f58] px-[1.25%] text-white ${region}`}
    >
      <div className="min-w-0">
        <p className="truncate text-[clamp(4px,.6vw,8px)] font-black uppercase tracking-[.16em] text-[#b6ff00]">
          {zone || "Your neighborhood"}
        </p>
        <h2 className="truncate text-[clamp(6px,1vw,13px)] font-black uppercase">
          {headline}
        </h2>
      </div>
      {side === "front"
        ? (
          <div
            className="flex h-full shrink-0 items-stretch overflow-hidden rounded-sm border border-white/60 bg-white text-[#102f58]"
            style={{ width: `${EDDM_POSTAL_BLOCK_WIDTH_PERCENT}%` }}
          >
            <div className="flex items-center px-2 text-[clamp(3px,.45vw,6px)] font-black uppercase leading-tight">
              Local<br />Postal Customer
            </div>
            <div className="flex items-center border-l border-[#102f58]/30 px-2 text-center text-[clamp(3px,.42vw,6px)] font-black uppercase leading-tight">
              Postage<br />Indicia Area
            </div>
          </div>
        )
        : (
          <div className="flex h-full shrink-0 items-center gap-2 text-right">
            <div>
              <b className="text-[clamp(7px,1vw,14px)]">
                adpadz<span className="text-[#b6ff00]">.co</span>
              </b>
              <p className="text-[clamp(3px,.45vw,6px)]">
                Discover more local offers with Adpadz.
              </p>
            </div>
            {qrDestination && (
              <CircularPadQR
                value={qrDestination}
                size={54}
                showShortLabel={false}
                className="h-[90%] w-auto"
              />
            )}
          </div>
        )}
    </div>
  );
}
