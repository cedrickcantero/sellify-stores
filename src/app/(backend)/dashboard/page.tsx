import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
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

export const metadata: Metadata = { title: "Dashboard | Sellify" };

const SHOWN_BUYBACKS = 5;

async function currentOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  return `${proto}://${h.get("host") ?? "localhost:3000"}`;
}

export default async function DashboardPage() {
  const { shopId, shop } = await getActiveShop();
  const summary = await getDashboardSummary(shopId, {
    origin: await currentOrigin(),
  });
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
          value={upcomingRepairs.length}
          note={
            <Link href="/repairs" className="underline">
              View repairs
            </Link>
          }
        />
        <StatCard
          label="Buybacks to receive"
          value={pendingBuybacks.length}
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
                : "Your store is offline. Publish it to take online orders."}
            </p>
          )}
        </div>
      </Card>

      <Card
        title="Upcoming repairs"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/repairs">View all</Link>
          </Button>
        }
      >
        <Table caption="Upcoming repairs">
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Repair</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcomingRepairs.length === 0 ? (
              <TableEmpty colSpan={4}>
                No repairs booked. Bookings from your store show up here.
              </TableEmpty>
            ) : (
              upcomingRepairs.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{slotFormat.format(ticket.slotStart)}</TableCell>
                  <TableCell>{ticket.customerName}</TableCell>
                  <TableCell>
                    {ticket.brand} {ticket.modelName}, {ticket.repairType}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card
        title="Buybacks awaiting drop-in"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/buybacks">View all</Link>
          </Button>
        }
      >
        <Table caption="Buybacks awaiting drop-in">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead align="right">Offer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingBuybacks.length === 0 ? (
              <TableEmpty colSpan={4}>
                No buybacks waiting. Accepted quotes show up here until you receive the device.
              </TableEmpty>
            ) : (
              pendingBuybacks.slice(0, SHOWN_BUYBACKS).map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>{quote.customer?.name ?? "Unknown"}</TableCell>
                  <TableCell>
                    {quote.brand} {quote.deviceName}, {quote.storage}
                  </TableCell>
                  <TableCell align="right">{formatCents(quote.offer)}</TableCell>
                  <TableCell>
                    <StatusBadge status={quote.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
