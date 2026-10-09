CREATE TABLE "repair_price" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"device_model_id" text NOT NULL,
	"repair_type_id" text NOT NULL,
	"price" integer NOT NULL,
	"part_qty" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repair_price_shop_model_type_unique" UNIQUE("shop_id","device_model_id","repair_type_id"),
	CONSTRAINT "repair_price_price_check" CHECK ("repair_price"."price" >= 0),
	CONSTRAINT "repair_price_part_qty_check" CHECK ("repair_price"."part_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "repair_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"repair_price_id" text NOT NULL,
	"price_snapshot" integer NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_seq" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repair_ticket_slot_seq_check" CHECK ("repair_ticket"."slot_seq" >= 1),
	CONSTRAINT "repair_ticket_price_check" CHECK ("repair_ticket"."price_snapshot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "repair_type" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repair_price" ADD CONSTRAINT "repair_price_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_price" ADD CONSTRAINT "repair_price_device_model_id_device_model_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_price" ADD CONSTRAINT "repair_price_repair_type_id_repair_type_id_fk" FOREIGN KEY ("repair_type_id") REFERENCES "public"."repair_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_ticket" ADD CONSTRAINT "repair_ticket_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_ticket" ADD CONSTRAINT "repair_ticket_repair_price_id_repair_price_id_fk" FOREIGN KEY ("repair_price_id") REFERENCES "public"."repair_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_type" ADD CONSTRAINT "repair_type_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repair_ticket_shop_slot_seq_unique" ON "repair_ticket" USING btree ("shop_id","slot_start","slot_seq") WHERE "repair_ticket"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "repair_ticket_shop_slot_idx" ON "repair_ticket" USING btree ("shop_id","slot_start");--> statement-breakpoint
CREATE UNIQUE INDEX "repair_type_shop_name_unique" ON "repair_type" USING btree ("shop_id",lower("name"));