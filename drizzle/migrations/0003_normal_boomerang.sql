CREATE TABLE "cart_items" (
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" smallint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_id_variant_id_pk" PRIMARY KEY("cart_id","variant_id"),
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"coupon_code" varchar(50),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_id_uq" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carts_updated_at_idx" ON "carts" USING btree ("updated_at");