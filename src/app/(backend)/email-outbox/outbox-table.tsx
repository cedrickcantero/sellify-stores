"use client";

import {
  Alert,
  Button,
  Modal,
  ModalClose,
  Pill,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";

export type OutboxRow = {
  id: string;
  kindLabel: string;
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sentAt: string;
};

export function OutboxTable({ rows }: { rows: OutboxRow[] }) {
  return (
    <Table caption="Emails sent for your shop">
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty colSpan={5}>
            No emails yet. Bookings, accepted buybacks and orders will show up here.
          </TableEmpty>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Pill>{row.kindLabel}</Pill>
              </TableCell>
              <TableCell>{row.recipient}</TableCell>
              <TableCell>
                <Modal
                  title={row.subject}
                  description={`To ${row.recipient}, ${row.sentAt}`}
                  footer={
                    <ModalClose asChild>
                      <Button variant="secondary">Close</Button>
                    </ModalClose>
                  }
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={`Open email: ${row.subject}`}>
                      {row.subject}
                    </Button>
                  }
                >
                  <div className="flex flex-col gap-4">
                    {row.status === "failed" ? (
                      <Alert tone="error">{`This email was not delivered. ${row.error ?? ""}`.trim()}</Alert>
                    ) : null}
                    {/* The body is HTML. A sandboxed frame with no permissions
                        shows it without running scripts or touching the page. */}
                    <iframe
                      title={`Body of ${row.subject}`}
                      sandbox=""
                      srcDoc={row.body}
                      className="h-64 w-full rounded-control border border-border bg-surface"
                    />
                  </div>
                </Modal>
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.sentAt}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
