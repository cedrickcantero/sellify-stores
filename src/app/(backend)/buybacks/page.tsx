import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { deviceCatalog, forShop } from "@/data";
import { answersSummary, formatEuros } from "@/domain/buyback-questions";
import {
  Card,
  FilterBar,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { DeductionForm, ruleName, type RuleValues } from "./deduction-form";
import { PriceForm } from "./price-form";
import { MarkReceivedButton, RemovePriceButton } from "./row-actions";

export const metadata: Metadata = { title: "Buybacks | Sellify" };

const VIEW_FILTER = {
  param: "view",
  label: "View",
  allLabel: "Prices",
  options: [{ value: "quotes", label: "Quotes" }],
};

export default async function BuybacksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const { shopId } = await getActiveShop();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buybacks"
        description="Set what you pay for phones and see the offers customers accepted."
      />
      <FilterBar filters={[VIEW_FILTER]} />
      {view === "quotes" ? <QuotesView shopId={shopId} /> : <PricesView shopId={shopId} />}
    </div>
  );
}

async function PricesView({ shopId }: { shopId: string }) {
  const repo = forShop(shopId).buybacks;
  const [catalog, prices, deductions] = await Promise.all([
    deviceCatalog.list(),
    repo.listBasePrices(),
    repo.listDeductions(),
  ]);
  const modelById = new Map(catalog.map((m) => [m.id, m]));
  const initial: RuleValues = {};
  for (const rule of deductions) {
    initial[ruleName(rule.questionKey, rule.answer)] = {
      kind: rule.kind,
      euros: (rule.value / 100).toFixed(2),
    };
  }

  return (
    <>
      <Card
        title="Base prices"
        description="One price for each model and storage size you buy."
        actions={
          <PriceForm
            models={catalog.map((m) => ({
              id: m.id,
              label: `${m.brand} ${m.name}`,
              storageOptions: m.storageOptions,
            }))}
          />
        }
      >
        <Table caption="Buyback base prices">
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead align="right">Base price</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 ? (
              <TableEmpty colSpan={4}>No base prices yet. Set one to start buying.</TableEmpty>
            ) : (
              prices.map((price) => {
                const model = modelById.get(price.deviceModelId);
                return (
                  <TableRow key={`${price.deviceModelId}-${price.storage}`}>
                    <TableCell>{model ? `${model.brand} ${model.name}` : price.deviceModelId}</TableCell>
                    <TableCell>{price.storage}</TableCell>
                    <TableCell align="right">{formatEuros(price.basePrice)}</TableCell>
                    <TableCell>
                      <RemovePriceButton
                        deviceModelId={price.deviceModelId}
                        storage={price.storage}
                        label={model ? `${model.brand} ${model.name}` : price.deviceModelId}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      <DeductionForm initial={initial} />
    </>
  );
}

async function QuotesView({ shopId }: { shopId: string }) {
  const quotes = await forShop(shopId).buybacks.listQuotes({
    statuses: ["accepted", "received"],
  });
  return (
    <Table caption="Accepted buyback quotes">
      <TableHeader>
        <TableRow>
          <TableHead>Device</TableHead>
          <TableHead>Answers</TableHead>
          <TableHead align="right">Offer</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.length === 0 ? (
          <TableEmpty colSpan={6}>No accepted buybacks yet.</TableEmpty>
        ) : (
          quotes.map((quote) => (
            <TableRow key={quote.id}>
              <TableCell>
                {quote.brand} {quote.deviceName}, {quote.storage}
              </TableCell>
              <TableCell>{answersSummary(quote.answers)}</TableCell>
              <TableCell align="right">{formatEuros(quote.offer)}</TableCell>
              <TableCell>
                {quote.customer ? (
                  <>
                    {quote.customer.name}
                    <br />
                    <span className="text-small text-muted-foreground">
                      {quote.customer.phone}, {quote.customer.email}
                    </span>
                  </>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusBadge status={quote.status === "received" ? "received" : "accepted"} />
              </TableCell>
              <TableCell>
                {quote.status === "accepted" ? (
                  <MarkReceivedButton quoteId={quote.id} />
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
