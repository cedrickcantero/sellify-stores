import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { deviceCatalog, forShop, type RepairTicketStatus } from "@/data";
import {
  Button,
  FilterBar,
  Field,
  Input,
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
import { PriceModal } from "./price-modal";
import { RepairTypeModal } from "./repair-type-modal";
import { TicketStatusSelect } from "./ticket-status-select";

export const metadata: Metadata = { title: "Repairs | Sellify" };

const STATUSES: RepairTicketStatus[] = ["booked", "in_progress", "done", "cancelled"];
const STATUS_LABELS: Record<RepairTicketStatus, string> = {
  booked: "Booked",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const euros = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RepairsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { shopId, shop } = await getActiveShop();
  const repairs = forShop(shopId).repairs;
  const view = one(params.view) === "tickets" ? "tickets" : "prices";

  const [types, catalog] = await Promise.all([repairs.listTypes(), deviceCatalog.list()]);
  const models = catalog.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }));
  const typeOptions = types.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Repairs"
        description="Repair prices and repair tickets, including online bookings."
        actions={
          <>
            <RepairTypeModal />
            <PriceModal
              primary
              triggerLabel="Add repair price"
              models={models}
              repairTypes={typeOptions}
            />
          </>
        }
      />
      <FilterBar
        filters={[
          {
            param: "view",
            label: "View",
            allLabel: "Price list",
            options: [{ value: "tickets", label: "Tickets" }],
          },
        ]}
      />
      {view === "prices" ? (
        <PriceList
          rows={await repairs.listPrices()}
          models={models}
          repairTypes={typeOptions}
        />
      ) : (
        <Tickets
          timezone={shop.timezone}
          status={STATUSES.find((s) => s === one(params.status))}
          date={validDate(one(params.date))}
          tickets={await repairs.listTickets({
            status: STATUSES.find((s) => s === one(params.status)),
            date: validDate(one(params.date)),
          })}
        />
      )}
    </div>
  );
}

function validDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

async function PriceList({
  rows,
  models,
  repairTypes,
}: {
  rows: Awaited<ReturnType<ReturnType<typeof forShop>["repairs"]["listPrices"]>>;
  models: { value: string; label: string }[];
  repairTypes: { value: string; label: string }[];
}) {
  return (
    <Table caption="Repair prices">
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead>Repair type</TableHead>
          <TableHead align="right">Price</TableHead>
          <TableHead align="right">Parts in stock</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={5}>No repair prices yet. Add a repair type, then a price.</TableEmpty>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {row.brand} {row.modelName}
              </TableCell>
              <TableCell>{row.repairType}</TableCell>
              <TableCell align="right">{euros(row.price)}</TableCell>
              <TableCell align="right">{row.partQty}</TableCell>
              <TableCell>
                <PriceModal
                  triggerLabel="Edit"
                  models={models}
                  repairTypes={repairTypes}
                  initial={{
                    deviceModelId: row.deviceModelId,
                    repairTypeId: row.repairTypeId,
                    price: (row.price / 100).toFixed(2),
                    partQty: String(row.partQty),
                  }}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function Tickets({
  tickets,
  timezone,
  status,
  date,
}: {
  tickets: Awaited<ReturnType<ReturnType<typeof forShop>["repairs"]["listTickets"]>>;
  timezone: string;
  status: RepairTicketStatus | undefined;
  date: string | undefined;
}) {
  const when = new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <FilterBar
            filters={[
              {
                param: "status",
                label: "Status",
                options: STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
              },
            ]}
          />
        </div>
        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="view" value="tickets" />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <Field label="Date">
            <Input type="date" name="date" defaultValue={date} />
          </Field>
          <Button type="submit" variant="secondary">
            Show date
          </Button>
        </form>
      </div>
      <Table caption="Repair tickets">
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Repair</TableHead>
            <TableHead align="right">Price</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Change status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableEmpty colSpan={7}>No repair tickets match.</TableEmpty>
          ) : (
            tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{when.format(ticket.slotStart)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{ticket.customerName}</span>
                    <span className="text-small text-muted-foreground">
                      {ticket.customerPhone} · {ticket.customerEmail}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {ticket.brand} {ticket.modelName}, {ticket.repairType}
                </TableCell>
                <TableCell align="right">{euros(ticket.priceSnapshot)}</TableCell>
                <TableCell>{ticket.source === "online" ? "Online" : "Walk-in"}</TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
