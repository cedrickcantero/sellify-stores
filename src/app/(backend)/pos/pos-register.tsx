"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@/domain/product";
import {
  Alert,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { completePosSaleAction } from "./actions";

export type PosProduct = { id: string; title: string; price: number; stockQty: number };

type Message = { tone: "error" | "success"; text: string };

// Pick quantities, see the total, complete the sale. The total shown uses the
// prices the server sent with the page; the server prices the sale again.
export function PosRegister({ products }: { products: PosProduct[] }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>();
  const [pending, startTransition] = useTransition();

  const lines = products
    .map((p) => ({ product: p, qty: Number(quantities[p.id] || 0) }))
    .filter((l) => l.qty > 0);
  const total = lines.reduce((sum, l) => sum + l.qty * l.product.price, 0);

  function complete() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await completePosSaleAction(
        lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      );
      if (result.saleId) {
        setQuantities({});
        setMessage({ tone: "success", text: `Sale completed: ${formatCents(total)}.` });
      } else if (result.outOfStock) {
        const names = result.outOfStock
          .map((id) => products.find((p) => p.id === id)?.title ?? "A product")
          .join(", ");
        setMessage({
          tone: "error",
          text: `Not enough stock for ${names}. Nothing was sold. Lower the quantity and try again.`,
        });
      } else {
        setMessage({ tone: "error", text: result.error ?? "The sale failed. Try again." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Table caption="Products in stock">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead align="right">Price</TableHead>
            <TableHead align="right">In stock</TableHead>
            <TableHead align="right">Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableEmpty colSpan={4}>No products in stock. Add stock in Inventory.</TableEmpty>
          ) : (
            products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.title}</TableCell>
                <TableCell align="right">{formatCents(p.price)}</TableCell>
                <TableCell align="right">{p.stockQty}</TableCell>
                <TableCell align="right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="0"
                    aria-label={`Quantity of ${p.title}`}
                    className="ml-auto w-24 text-right"
                    value={quantities[p.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((prev) => ({ ...prev, [p.id]: event.target.value }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Card
        title="Total"
        description={
          lines.length === 0
            ? "Enter a quantity to start a sale."
            : `${lines.reduce((n, l) => n + l.qty, 0)} items`
        }
        actions={<span className="text-section font-heading">{formatCents(total)}</span>}
        footer={
          <Button disabled={lines.length === 0 || pending} onClick={complete}>
            {pending ? "Completing sale" : "Complete sale"}
          </Button>
        }
      >
        <p className="text-small text-muted-foreground">
          Prices are checked again when you complete the sale.
        </p>
      </Card>
    </div>
  );
}
