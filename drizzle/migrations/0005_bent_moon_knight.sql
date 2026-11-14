CREATE TYPE "public"."coupon_redemption_status" AS ENUM('reserved', 'committed', 'released');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."discount_scope_type" AS ENUM('all', 'category', 'brand', 'product', 'variant');--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "coupon_redemption_status" DEFAULT 'reserved' NOT NULL,
	"discount_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_targets" (
	"coupon_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "coupon_targets_coupon_id_target_id_pk" PRIMARY KEY("coupon_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"value" bigint NOT NULL,
	"max_discount" bigint,
	"min_order_amount" bigint,
	"scope_type" "discount_scope_type" NOT NULL,
	"apply_to_discounted_items" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit_total" integer,
	"usage_limit_per_user" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_value_positive" CHECK ("coupons"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "discount_targets" (
	"discount_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "discount_targets_discount_id_target_id_pk" PRIMARY KEY("discount_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"value" bigint NOT NULL,
	"max_discount_per_unit" bigint,
	"scope_type" "discount_scope_type" NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_value_positive" CHECK ("discounts"."value" > 0),
	CONSTRAINT "discounts_period_valid" CHECK ("discounts"."starts_at" is null or "discounts"."ends_at" is null or "discounts"."starts_at" < "discounts"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_targets" ADD CONSTRAINT "coupon_targets_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_coupon_order_uq" ON "coupon_redemptions" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_order_id_idx" ON "coupon_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_status_idx" ON "coupon_redemptions" USING btree ("coupon_id","status");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_user_status_idx" ON "coupon_redemptions" USING btree ("coupon_id","user_id","status");--> statement-breakpoint
CREATE INDEX "coupon_targets_target_id_idx" ON "coupon_targets" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uq" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "discount_targets_target_id_idx" ON "discount_targets" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "discounts_active_period_idx" ON "discounts" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "discounts_created_at_idx" ON "discounts" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "discounts_name_id_idx" ON "discounts" USING btree ("name","id");