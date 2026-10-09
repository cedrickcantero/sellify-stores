CREATE TABLE "sale" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"channel" text NOT NULL,
	"total" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"stripe_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_stripeSessionId_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "sale_total_non_negative" CHECK ("sale"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"title_snapshot" text NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	CONSTRAINT "sale_item_quantity_positive" CHECK ("sale_item"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_shop_created_idx" ON "sale" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_item_sale_id_idx" ON "sale_item" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_item_product_id_idx" ON "sale_item" USING btree ("product_id");