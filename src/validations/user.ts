import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  name: z.string().min(1, "Nama wajib diisi"),
  role: z.enum(["SUPER_ADMIN", "ADMIN_IT", "KEPALA_SEKOLAH", "GURU", "STAFF", "SISWA"]),
  password: z.string().min(6, "Kata sandi minimal 6 karakter").optional(),
  tenantId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN_IT", "KEPALA_SEKOLAH", "GURU", "STAFF", "SISWA"]).optional(),
  isActive: z.boolean().optional(),
  image: z.string().nullable().optional(),
});
