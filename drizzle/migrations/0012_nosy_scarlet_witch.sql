ALTER TABLE "orders" ADD COLUMN "shipping_method_code" varchar(30) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_method_name" varchar(60) DEFAULT '' NOT NULL;