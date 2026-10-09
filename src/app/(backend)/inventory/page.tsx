import type { Metadata } from "next";
import { getActiveShop } from "@/auth/session";
import { deviceCatalog, forShop, type ProductFilter } from "@/data";
import {
  CONDITION_LABELS,
  KIND_LABELS,
  PRODUCT_CONDITIONS,
  PRODUCT_KINDS,
  formatCents,
  stockStatus,
} from "@/domain/product";
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
  type SelectOption,
} from "@/ui";
import { AddProductButton } from "./add-product-button";
import { RowActions } from "./row-actions";

export const metadata: Metadata = { title: "Inventory | Sellify" };

const filters: FilterDef[] = [
  {
    param: "kind",
    label: "Kind",
    options: PRODUCT_KINDS.map((value) => ({ value, label: KIND_LABELS[value] })),
  },
  {
    param: "condition",
    label: "Condition",
    options: PRODUCT_CONDITIONS.map((value) => ({ value, label: CONDITION_LABELS[value] })),
  },
  {
    param: "stock",
    label: "Stock",
    options: [
      { value: "in", label: "In stock" },
      { value: "out", label: "Sold out" },
    ],
  },
];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Unknown or repeated search params are ignored rather than trusted.
function readFilter(params: Record<string, string | string[] | undefined>): ProductFilter {
  const kind = PRODUCT_KINDS.find((v) => v === one(params.kind));
  const condition = PRODUCT_CONDITIONS.find((v) => v === one(params.condition));
  const stock = one(params.stock);
  return {
    ...(kind ? { kind } : {}),
    ...(condition ? { condition } : {}),
    ...(stock === "in" || stock === "out" ? { stock } : {}),
  };
}

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const { shopId } = await getActiveShop();
  const filter = readFilter(await searchParams);
  const [products, catalog] = await Promise.all([
    forShop(shopId).products.list(filter),
    deviceCatalog.list(),
  ]);
  const models: SelectOption[] = catalog.map((m) => ({
    value: m.id,
    label: `${m.brand} ${m.name}`,
  }));
  const modelName = new Map(models.map((m) => [m.value, m.label]));
  const filtered = Object.keys(filter).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Your phones and accessories, with stock and photos."
        actions={<AddProductButton models={models} />}
      />
      <FilterBar filters={filters} />
      <Table caption="Products">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead align="right">Price</TableHead>
            <TableHead align="right">Stock</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableEmpty colSpan={7}>
              {filtered
                ? "No products match these filters. Clear a filter to see more."
                : "No products yet. Add your first phone or accessory."}
            </TableEmpty>
          ) : (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {product.images[0] ? (
                      // Blob URLs are public and served from Vercel's storage domain.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt=""
                        className="size-10 shrink-0 rounded-control border border-border object-cover"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{product.title}</span>
                      {product.deviceModelId ? (
                        <span className="text-small text-muted-foreground">
                          {modelName.get(product.deviceModelId)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Pill>{KIND_LABELS[product.kind]}</Pill>
                </TableCell>
                <TableCell>{CONDITION_LABELS[product.condition]}</TableCell>
                <TableCell align="right">{formatCents(product.price)}</TableCell>
                <TableCell align="right">{product.stockQty}</TableCell>
                <TableCell>
                  <StatusBadge status={stockStatus(product.stockQty)} />
                </TableCell>
                <TableCell align="right">
                  <RowActions
                    models={models}
                    product={{
                      id: product.id,
                      title: product.title,
                      kind: product.kind,
                      condition: product.condition,
                      price: (product.price / 100).toFixed(2),
                      stockQty: product.stockQty,
                      images: product.images,
                      deviceModelId: product.deviceModelId,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
