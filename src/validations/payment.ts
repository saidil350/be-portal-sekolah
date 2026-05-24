import { z } from "zod";

export const payInvoiceSchema = z.object({
  paymentMethod: z.enum(["QRIS", "BANK_TRANSFER"]),
});
