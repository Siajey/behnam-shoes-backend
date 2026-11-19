CREATE TABLE "product_stats" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"units_sold" integer DEFAULT 0 NOT NULL,
	"favorites_added" integer DEFAULT 0 NOT NULL,
	"is_best_seller" boolean DEFAULT false NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_stats" ADD CONSTRAINT "product_stats_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_stats_best_seller_idx" ON "product_stats" USING btree ("is_best_seller");--> statement-breakpoint
CREATE INDEX "product_stats_popular_idx" ON "product_stats" USING btree ("is_popular");