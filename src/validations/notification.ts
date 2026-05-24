import { z } from "zod";

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  message: z.string().min(1, "Pesan wajib diisi"),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ALERT", "ATTENDANCE", "PAYMENT", "ASSIGNMENT"]),
  userId: z.string().uuid().optional(),
  link: z.string().optional(),
});
