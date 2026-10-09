CREATE TABLE "buyback_deduction" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"question_key" text NOT NULL,
	"answer" boolean NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "buyback_deduction_shop_question_answer_unique" UNIQUE("shop_id","question_key","answer")
);
--> statement-breakpoint
CREATE TABLE "buyback_price" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"device_model_id" text NOT NULL,
	"storage" text NOT NULL,
	"base_price" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyback_price_shop_model_storage_unique" UNIQUE("shop_id","device_model_id","storage")
);
--> statement-breakpoint
CREATE TABLE "buyback_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"device_model_id" text NOT NULL,
	"storage" text NOT NULL,
	"answers" jsonb NOT NULL,
	"offer" integer NOT NULL,
	"status" text DEFAULT 'quoted' NOT NULL,
	"handover" text DEFAULT 'drop_in' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyback_deduction" ADD CONSTRAINT "buyback_deduction_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_price" ADD CONSTRAINT "buyback_price_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_price" ADD CONSTRAINT "buyback_price_device_model_id_device_model_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_quote" ADD CONSTRAINT "buyback_quote_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_quote" ADD CONSTRAINT "buyback_quote_device_model_id_device_model_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buyback_deduction_shop_id_idx" ON "buyback_deduction" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "buyback_price_shop_id_idx" ON "buyback_price" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "buyback_quote_shop_id_idx" ON "buyback_quote" USING btree ("shop_id","status");