import type { Metadata } from "next";
import Link from "next/link";
import { getActiveShop } from "@/auth/session";
import { formatCents } from "@/domain/product";
import { getDashboardSummary } from "@/services/dashboard";
import {
  Button,
  Card,
  CardGrid,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { currentOrigin } from "../current-origin";

export const metadata: Metadata = { title: "Dashboard | Sellify" };

export default async function DashboardPage() {
  const { shopId, shop } = await getActiveShop();
  const summary = await getDashboardSummary(shopId, { origin: await currentOrigin(), shop });
  const slotFormat = new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: shop.timezone,
  });
  const { salesToday, upcomingRepairs, pendingBuybacks, store } = summary;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Today's sales, upcoming repairs, pending buybacks and your store status."
      />

      <CardGrid columns={3}>
        <StatCard
          label="Sales today"
          value={formatCents(salesToday.total)}
          note={
            <Link href="/sales" className="underline">
              {salesToday.count === 1 ? "1 sale" : `${salesToday.count} sales`}
            </Link>
          }
        />
        <StatCard
          label="Upcoming repairs"
          value={summary.upcomingRepairCount}
          note={
            <Link href="/repairs" className="underline">
              View repairs
            </Link>
          }
        />
        <StatCard
          label="Buybacks to receive"
          value={summary.pendingBuybackCount}
          note={
            <Link href="/buybacks" className="underline">
              View buybacks
            </Link>
          }
        />
      </CardGrid>

      <Card
        title="Online store"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/online-store">Manage store</Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={store.online ? "online" : "offline"} />
          {store.online && store.address ? (
            <a href={store.address} className="break-all text-body text-primary underline">
              {store.address}
            </a>
          ) : (
            <p className="text-body text-muted-foreground">
              {store.online
                ? "Your store is live."
                : store.published
                  ? "Your store is offline. Turn it on to take online orders."
                  : "Your store is offline. Publish it to take online orders."}
            </p>
          )}
        </div>
      </Card>

      <Card
        title="Upcoming repairs"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/repairs?view=tickets">View all</Link>
          </Button>
        }
      >
        <Table caption="Upcoming repairs">
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Repair</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcomingRepairs.length === 0 ? (
              <TableEmpty
                colSpan={3}
                action={
                  <Button asChild size="sm">
                    <Link href="/repairs">Set repair prices</Link>
                  </Button>
                }
              >
                No repairs booked. Set repair prices so customers can book from your store.
              </TableEmpty>
            ) : (
              upcomingRepairs.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{slotFormat.format(ticket.slotStart)}</TableCell>
                  <TableCell>{ticket.customerName}</TableCell>
                  <TableCell>
                    {ticket.brand} {ticket.modelName}, {ticket.repairType}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card
        title="Buybacks to receive"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/buybacks">View all</Link>
          </Button>
        }
      >
        <Table caption="Buybacks to receive">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead align="right">Offer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingBuybacks.length === 0 ? (
              <TableEmpty
                colSpan={3}
                action={
                  <Button asChild size="sm">
                    <Link href="/buybacks">Set buyback prices</Link>
                  </Button>
                }
              >
                No buybacks waiting. Set buyback prices so customers can sell you their devices.
              </TableEmpty>
            ) : (
              pendingBuybacks.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>{quote.customer?.name ?? "Unknown"}</TableCell>
                  <TableCell>
                    {quote.brand} {quote.deviceName}, {quote.storage}
                  </TableCell>
                  <TableCell align="right">{formatCents(quote.offer)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
