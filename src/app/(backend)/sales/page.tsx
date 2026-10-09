import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { forShop, type SaleFilter } from "@/data";
import { formatCents } from "@/domain/product";
import {
  FilterBar,
  PageHeader,
  Pill,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  type FilterDef,
} from "@/ui";

export const metadata: Metadata = { title: "Sales | Sellify" };

const CHANNEL_LABELS = { pos: "POS", online: "Online" } as const;

const filters: FilterDef[] = [
  {
    param: "channel",
    label: "Channel",
    options: [
      { value: "pos", label: "POS" },
      { value: "online", label: "Online" },
    ],
  },
  {
    param: "status",
    label: "Status",
    options: [
      { value: "completed", label: "Completed" },
      { value: "needs_refund", label: "Needs refund" },
    ],
  },
];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Unknown or repeated search params are ignored rather than trusted.
function readFilter(params: Record<string, string | string[] | undefined>): SaleFilter {
  const channel = one(params.channel);
  const status = one(params.status);
  return {
    ...(channel === "pos" || channel === "online" ? { channel } : {}),
    ...(status === "completed" || status === "needs_refund" ? { status } : {}),
  };
}

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const { shopId, shop } = await getActiveShop();
  const filter = readFilter(await searchParams);
  const sales = await forShop(shopId).sales.list(filter);
  const format = new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: shop.timezone,
  });
  const filtered = Object.keys(filter).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales"
        description="Every POS and online sale, with its channel and status."
      />
      <FilterBar filters={filters} />
      <Table caption="Sales">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Items</TableHead>
            <TableHead align="right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.length === 0 ? (
            <TableEmpty colSpan={5}>
              {filtered
                ? "No sales match these filters. Clear a filter to see more."
                : "No sales yet. Ring up a sale on the POS page."}
            </TableEmpty>
          ) : (
            sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{format.format(sale.createdAt)}</TableCell>
                <TableCell>
                  <Pill>{CHANNEL_LABELS[sale.channel]}</Pill>
                </TableCell>
                <TableCell>
                  {sale.items.length > 0
                    ? sale.items.map((item) => `${item.quantity} x ${item.title}`).join(", ")
                    : "Items not recorded. Check the payment in Stripe."}
                </TableCell>
                <TableCell align="right">{formatCents(sale.total)}</TableCell>
                <TableCell>
                  <StatusBadge status={sale.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
