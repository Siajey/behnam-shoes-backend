CREATE INDEX "favorites_created_at_idx" ON "favorites" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_paid_at_idx" ON "orders" USING btree ("paid_at");