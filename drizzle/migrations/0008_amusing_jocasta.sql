CREATE TYPE "public"."attribute_type" AS ENUM('text', 'number', 'boolean', 'select', 'multi_select');--> statement-breakpoint
CREATE TABLE "attribute_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(40) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "attribute_type" NOT NULL,
	"product_type" "product_type",
	"unit" varchar(20),
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"value" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"option_id" uuid,
	"text_value" varchar(500),
	"number_value" double precision,
	"boolean_value" boolean,
	CONSTRAINT "product_attribute_values_one_value" CHECK (num_nonnulls("product_attribute_values"."option_id", "product_attribute_values"."text_value", "product_attribute_values"."number_value", "product_attribute_values"."boolean_value") = 1)
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "image_key" varchar(255);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_key" varchar(255);--> statement-breakpoint
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_definitions_key_uq" ON "attribute_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "attribute_definitions_position_idx" ON "attribute_definitions" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_options_definition_value_uq" ON "attribute_options" USING btree ("definition_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_single_uq" ON "product_attribute_values" USING btree ("product_id","definition_id") WHERE "product_attribute_values"."option_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_option_uq" ON "product_attribute_values" USING btree ("product_id","definition_id","option_id") WHERE "product_attribute_values"."option_id" is not null;--> statement-breakpoint
CREATE INDEX "product_attribute_values_definition_option_idx" ON "product_attribute_values" USING btree ("definition_id","option_id");