import { z } from "zod";

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  selfieUrl: z.string().min(1).optional(),
  faceVerified: z.boolean().optional(),
  notes: z.string().optional(),
});

export const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  selfieUrl: z.string().min(1).optional(),
  faceVerified: z.boolean().optional(),
  notes: z.string().optional(),
});
