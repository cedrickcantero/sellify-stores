CREATE TABLE "custom_domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"hostname" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_domain_hostname_unique" UNIQUE("hostname"),
	CONSTRAINT "custom_domain_status_check" CHECK ("custom_domain"."status" in ('pending', 'verified', 'error')),
	CONSTRAINT "custom_domain_hostname_lower_check" CHECK ("custom_domain"."hostname" = lower("custom_domain"."hostname"))
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_config" (
	"shop_id" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"online" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_config_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"config" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text
);
--> statement-breakpoint
ALTER TABLE "custom_domain" ADD CONSTRAINT "custom_domain_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_config" ADD CONSTRAINT "store_config_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_config_version" ADD CONSTRAINT "store_config_version_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_config_version" ADD CONSTRAINT "store_config_version_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_domain_shop_idx" ON "custom_domain" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "store_config_version_shop_idx" ON "store_config_version" USING btree ("shop_id","published_at");