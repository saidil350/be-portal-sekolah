import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").optional(),
  image: z.string().nullable().optional(),
  phone: z
    .string()
    .regex(/^[0-9+-\s]{9,20}$/, "Nomor telepon tidak valid")
    .optional()
    .or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  birthPlace: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  nik: z.string().optional().or(z.literal("")),
  religion: z.string().optional().or(z.literal("")),
  fatherName: z.string().optional().or(z.literal("")),
  fatherOccupation: z.string().optional().or(z.literal("")),
  motherName: z.string().optional().or(z.literal("")),
  motherOccupation: z.string().optional().or(z.literal("")),
  guardianName: z.string().optional().or(z.literal("")),
  guardianPhone: z.string().optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
