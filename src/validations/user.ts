import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  name: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  role: z.enum(["ADMIN_IT", "KEPALA_SEKOLAH", "GURU", "SISWA", "STAFF"]),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .regex(/.*[A-Za-z].*/, "Kata sandi harus mengandung minimal satu huruf")
    .regex(/.*[0-9].*/, "Kata sandi harus mengandung minimal satu angka"),
  phoneNumber: z
    .string()
    .regex(/^[0-9+]{10,15}$/, "Nomor telepon harus berupa angka (10-15 digit)")
    .optional()
    .or(z.literal("")),
  tenantId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN_IT", "KEPALA_SEKOLAH", "GURU", "SISWA"]).optional(),
  isActive: z.boolean().optional(),
  image: z.string().nullable().optional(),
});
