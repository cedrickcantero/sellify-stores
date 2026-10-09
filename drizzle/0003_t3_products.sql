CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"condition" text NOT NULL,
	"price" integer NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"device_model_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "product_stock_qty_non_negative" CHECK ("product"."stock_qty" >= 0),
	CONSTRAINT "product_price_positive" CHECK ("product"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_device_model_id_device_model_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_shop_id_idx" ON "product" USING btree ("shop_id");