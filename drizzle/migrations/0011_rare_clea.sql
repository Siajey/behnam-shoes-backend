CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" varchar(200),
	"carrier" varchar(30) NOT NULL,
	"service" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"fallback_fee" bigint,
	"free_threshold" bigint,
	"handling_fee" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_methods_handling_fee_non_negative" CHECK ("shipping_methods"."handling_fee" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_methods_code_uq" ON "shipping_methods" USING btree ("code");--> statement-breakpoint
CREATE INDEX "shipping_methods_active_position_idx" ON "shipping_methods" USING btree ("is_active","position");