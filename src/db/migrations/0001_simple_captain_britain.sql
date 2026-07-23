ALTER TYPE "public"."payment_status" ADD VALUE 'REFUNDED';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'CHARGEBACK';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'CHALLENGE';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'AUTHORIZED';