ALTER TABLE "payments" DROP CONSTRAINT "payments_amount_positive";--> statement-breakpoint
DROP INDEX "payments_gateway_reference_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_reference_uq" ON "payments" USING btree ("gateway","reference") WHERE "payments"."reference"
    is not null;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount"
    > 0);