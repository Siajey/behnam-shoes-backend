CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'redirected', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"gateway" varchar(30) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"reference" varchar(100),
	"tracking_code" varchar(100),
	"card_mask" varchar(30),
	"failure_reason" varchar(100),
	"paid_at" timestamp with time zone,
	"order_confirmed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_reference_uq" ON "payments" USING btree ("gateway","reference") WHERE "payments"."reference" is not null;--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_at_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_unconfirmed_idx" ON "payments" USING btree ("status","order_confirmed_at");--> statement-breakpoint
CREATE INDEX "favorites_created_at_idx" ON "favorites" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_paid_at_idx" ON "orders" USING btree ("paid_at");