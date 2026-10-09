import Link from "next/link";
import { notFound } from "next/navigation";
import { deviceCatalog, forShop } from "@/data";
import { answersSummary, formatEuros } from "@/domain/buyback-questions";
import { parseQuoteId } from "@/domain/buyback-forms";
import { storeHref, storeLinkButtonClass } from "@/store-ui";
import { requireLiveStore } from "../../../store-context";
import { AcceptForm } from "./accept-form";

// The offer is read from the database by quote id (only this shop's quotes
// are visible); nothing about the price comes from the browser.
export default async function OfferPage({ params }: PageProps<"/s/[slug]/sell/offer/[quoteId]">) {
  const { slug, quoteId: rawId } = await params;
  const { shopId, basePath } = await requireLiveStore(slug, "sell");
  const quoteId = parseQuoteId(rawId);
  if (!quoteId) notFound();

  const repos = forShop(shopId);
  const quote = await repos.buybacks.getQuote(quoteId);
  if (!quote) notFound();
  const [models, shop] = await Promise.all([deviceCatalog.list(), repos.shop.get()]);
  const model = models.find((m) => m.id === quote.deviceModelId);
  const device = `${model ? `${model.brand} ${model.name}` : "Your phone"}, ${quote.storage}`;
  const expires = quote.expiresAt.toLocaleDateString("en-IE", {
    dateStyle: "long",
    timeZone: shop?.timezone || "Europe/Dublin",
  });
  const sellHref = storeHref(basePath, "/sell");

  if (quote.status !== "quoted") {
    return (
      <div className="flex max-w-xl flex-col gap-4" aria-live="polite">
        <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">
          {quote.status === "cancelled" ? "This offer was cancelled" : "Offer accepted"}
        </h1>
        {quote.status === "cancelled" ? (
          <Link href={sellHref} className={`${storeLinkButtonClass} self-start`}>
            Get a new offer
          </Link>
        ) : (
          <>
            <p className="text-xl">
              <span className="font-bold">{formatEuros(quote.offer)}</span> for your {device}
            </p>
            <p>
              Drop in to the shop with your phone and we will pay you. We have emailed you a confirmation.
            </p>
          </>
        )}
      </div>
    );
  }

  if (quote.expiresAt <= new Date()) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">Quote expired, get a new one</h1>
        <p>This offer ran out on {expires}. Prices can change, so check your phone again.</p>
        <Link href={sellHref} className={`${storeLinkButtonClass} self-start`}>
          Get a new offer
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section aria-labelledby="offer-heading" className="flex flex-col gap-3">
        <h1 id="offer-heading" className="font-(family-name:--store-font-heading) text-3xl font-bold">
          Your offer
        </h1>
        <p className="font-(family-name:--store-font-heading) text-5xl font-bold text-(--store-primary)">
          {formatEuros(quote.offer)}
        </p>
        <p className="text-lg font-semibold">{device}</p>
        <p>{answersSummary(quote.answers)}</p>
        <p>This offer is valid until {expires}.</p>
      </section>

      <section aria-labelledby="accept-heading" className="flex flex-col gap-4">
        <h2 id="accept-heading" className="font-(family-name:--store-font-heading) text-2xl font-bold">
          Accept this offer
        </h2>
        <p>Leave your details and drop in to the shop with your phone. We pay you on the spot.</p>
        <AcceptForm slug={slug} quoteId={quote.id} />
      </section>

      <Link href={sellHref} className="self-start underline underline-offset-4">
        Start again with a different phone
      </Link>
    </div>
  );
}
