CREATE TYPE "public"."tracking_status" AS ENUM('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed');--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_key" varchar(200) NOT NULL,
	"status" "tracking_status" NOT NULL,
	"description" varchar(500) NOT NULL,
	"location" varchar(200),
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method_code" varchar(30) NOT NULL,
	"carrier" varchar(30) NOT NULL,
	"tracking_code" varchar(64) NOT NULL,
	"status" "tracking_status" DEFAULT 'created' NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_events_key_uq" ON "shipment_events" USING btree ("shipment_id","event_key");--> statement-breakpoint
CREATE INDEX "shipment_events_time_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_order_id_uq" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_poll_idx" ON "shipments" USING btree ("status","next_check_at");--> statement-breakpoint
CREATE INDEX "shipments_delivered_at_idx" ON "shipments" USING btree ("delivered_at");