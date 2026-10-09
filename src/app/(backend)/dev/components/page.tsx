import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ColorInputDemo } from "./color-input-demo";
import {
  Button,
  Card,
  CardGrid,
  Field,
  FilterBar,
  Input,
  Modal,
  ModalClose,
  PageHeader,
  Pill,
  Select,
  StatCard,
  StatusBadge,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Alert,
  STATUS_LIST,
} from "@/ui";

export const metadata: Metadata = { title: "Components | Sellify" };

// Dev-only gallery of every ui component and variant, for eyeballing
// consistency. Not linked from the sidebar and not served in production.
// The gallery documents each token's code, so these strings are the one
// place in the backend where hex values are allowed.
/* eslint-disable no-restricted-syntax */
const SWATCHES = [
  { name: "primary", code: "#9333EA", className: "bg-primary" },
  { name: "primary-hover", code: "#7E22CE", className: "bg-primary-hover" },
  { name: "primary-tint", code: "#FAF5FF", className: "bg-primary-tint" },
  { name: "primary-border", code: "#D8B4FE", className: "bg-primary-border" },
  { name: "primary-foreground", code: "#FFFFFF", className: "bg-primary-foreground" },
  { name: "foreground", code: "#171717", className: "bg-foreground" },
  { name: "secondary-foreground", code: "#4B5563", className: "bg-secondary-foreground" },
  { name: "muted-foreground", code: "#6B7280", className: "bg-muted-foreground" },
  { name: "surface", code: "#FFFFFF", className: "bg-surface" },
  { name: "background", code: "#F9FAFB", className: "bg-background" },
  { name: "surface-muted", code: "#F3F4F6", className: "bg-surface-muted" },
  { name: "border", code: "#E5E7EB", className: "bg-border" },
  { name: "input", code: "#868C96", className: "bg-input" },
  { name: "success", code: "#16A34A", className: "bg-success" },
  { name: "success-text", code: "#15803D", className: "bg-success-text" },
  { name: "success-tint", code: "#F0FDF4", className: "bg-success-tint" },
  { name: "warning", code: "#D97706", className: "bg-warning" },
  { name: "warning-text", code: "#B45309", className: "bg-warning-text" },
  { name: "warning-tint", code: "#FFFBEB", className: "bg-warning-tint" },
  { name: "error", code: "#DC2626", className: "bg-error" },
  { name: "error-text", code: "#B91C1C", className: "bg-error-text" },
  { name: "error-tint", code: "#FEF2F2", className: "bg-error-tint" },
];
/* eslint-enable no-restricted-syntax */

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "used", label: "Used" },
];

const PRODUCTS = [
  { title: "iPhone 13 128GB", kind: "Phone", condition: "Refurbished", price: "€429.00", stock: 3 },
  { title: "Galaxy S22 256GB", kind: "Phone", condition: "Used", price: "€349.00", stock: 0 },
  { title: "USB-C cable 1m", kind: "Accessory", condition: "New", price: "€12.00", stock: 24 },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export default function ComponentGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <PageHeader
        title="Components"
        description="Every ui component and variant. Dev only."
        actions={
          <>
            <Button variant="secondary">Export</Button>
            <Button>Add product</Button>
          </>
        }
      />

      <Section title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-1.5">
              <div className={`h-12 rounded-control border border-border ${swatch.className}`} />
              <p className="text-small font-medium text-foreground">{swatch.name}</p>
              <p className="text-small text-muted-foreground">{swatch.code}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="font-heading text-page-title text-foreground">Page title, 24px bold</p>
        <p className="font-heading text-section text-foreground">Section heading, 18px semibold</p>
        <p className="text-body text-foreground">Body text, 14px. Used for tables, forms and copy.</p>
        <p className="text-body text-muted-foreground">Muted body text for descriptions.</p>
        <p className="text-small text-muted-foreground">Small print, 12px.</p>
      </Section>

      <Section title="Button">
        <Row>
          <Button>Publish store</Button>
          <Button variant="secondary">Preview</Button>
          <Button variant="ghost">View all</Button>
          <Button variant="destructive">Remove product</Button>
        </Row>
        <Row>
          <Button size="sm">Save</Button>
          <Button size="sm" variant="secondary">
            Cancel
          </Button>
          <Button size="sm" variant="ghost">
            Edit
          </Button>
          <Button size="sm" variant="destructive">
            Remove
          </Button>
        </Row>
        <Row>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button asChild variant="secondary">
            <Link href="/inventory">Link as button</Link>
          </Button>
        </Row>
      </Section>

      <Section title="Pill and StatusBadge">
        <Row>
          <Pill>POS</Pill>
          <Pill>Online</Pill>
          <Pill tone="primary">Phone</Pill>
          <Pill tone="primary">Accessory</Pill>
        </Row>
        <Row>
          {STATUS_LIST.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </Row>
      </Section>

      <Section title="Alert">
        <Alert tone="error">Wrong email or password.</Alert>
        <Alert tone="success">Store published.</Alert>
        <Alert tone="warning">You have unpublished changes.</Alert>
        <Alert tone="info">Your store is in preview.</Alert>
      </Section>

      <Section title="Form controls">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title" hint="Shown on your store.">
            <Input name="title" placeholder="iPhone 13 128GB" />
          </Field>
          <Field label="Price" error="Enter a price above 0.">
            <Input name="price" inputMode="decimal" defaultValue="0" />
          </Field>
          <Field label="Condition">
            <Select name="condition" options={CONDITIONS} placeholder="Choose condition" />
          </Field>
          <Field label="Condition (chosen)">
            <Select name="condition2" options={CONDITIONS} defaultValue="refurbished" />
          </Field>
          <Field label="Disabled">
            <Input disabled defaultValue="Read only" />
          </Field>
          <Field label="Search">
            <Input type="search" placeholder="Search products" />
          </Field>
          <Field label="Brand colour" hint="Picker plus hex code.">
            <ColorInputDemo />
          </Field>
          <Field label="About" className="md:col-span-2">
            <Textarea placeholder="Tell customers about your shop." />
          </Field>
        </div>
        <div className="flex max-w-md flex-col gap-4">
          <Switch label="Store online" description="Customers can visit your store." defaultChecked />
          <Switch label="Show banner" />
          <Switch label="Disabled switch" disabled />
        </div>
      </Section>

      <Section title="Modal">
        <Row>
          <Modal
            trigger={<Button>Add product</Button>}
            title="Add product"
            description="Add a phone or accessory to your inventory."
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </ModalClose>
                <Button>Save product</Button>
              </>
            }
          >
            <Field label="Title">
              <Input placeholder="iPhone 13 128GB" />
            </Field>
            <Field label="Condition">
              <Select options={CONDITIONS} />
            </Field>
            <Field label="Price" error="Enter a price above 0.">
              <Input inputMode="decimal" />
            </Field>
          </Modal>
          <Modal
            size="sm"
            trigger={<Button variant="destructive">Remove product</Button>}
            title="Remove product?"
            description="It disappears from your inventory and your store."
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="secondary">Keep it</Button>
                </ModalClose>
                <Button variant="destructive">Remove</Button>
              </>
            }
          />
        </Row>
      </Section>

      <Section title="Card">
        <CardGrid columns={3}>
          <StatCard label="Sales today" value="€1,240.00" note="8 sales" />
          <StatCard label="Upcoming repairs" value="5" note="Next at 14:00" />
          <StatCard label="Store" value={<StatusBadge status="online" />} note="fixit-galway" />
        </CardGrid>
        <Card
          title="Card with actions"
          description="A section of a settings page."
          actions={<Button variant="ghost" size="sm">View all</Button>}
          footer={<Button>Save</Button>}
        >
          <p className="text-body text-foreground">Card content.</p>
        </Card>
      </Section>

      <h2 className="font-heading text-section text-foreground">Page recipe: PageHeader, FilterBar, Table</h2>
      <FilterBar
        search={{ param: "q", placeholder: "Search products" }}
        filters={[
          {
            param: "kind",
            label: "Kind",
            options: [
              { value: "phone", label: "Phones" },
              { value: "accessory", label: "Accessories" },
            ],
          },
          {
            param: "stock",
            label: "Stock",
            options: [
              { value: "in", label: "In stock" },
              { value: "out", label: "Sold out" },
            ],
          },
        ]}
      />
      <Table caption="Products">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead align="right">Price</TableHead>
            <TableHead align="right">Stock</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PRODUCTS.map((product) => (
            <TableRow key={product.title}>
              <TableCell className="font-medium">{product.title}</TableCell>
              <TableCell>
                <Pill>{product.kind}</Pill>
              </TableCell>
              <TableCell>{product.condition}</TableCell>
              <TableCell align="right">{product.price}</TableCell>
              <TableCell align="right">
                {product.stock > 0 ? product.stock : <StatusBadge status="sold_out" />}
              </TableCell>
              <TableCell align="right">
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Table caption="Empty products">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead align="right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={2} action={<Button size="sm">Add product</Button>}>
            No products yet.
          </TableEmpty>
        </TableBody>
      </Table>
    </>
  );
}
