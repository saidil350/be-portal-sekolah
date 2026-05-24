import { z } from "zod";

export const createClassSchema = z.object({
  name: z.string().min(1, "Nama kelas wajib diisi"),
  code: z.string().min(1, "Kode kelas wajib diisi"),
  gradeLevel: z.number().int().min(1).max(12),
  homeroomTeacherId: z.string().uuid(),
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi"),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  gradeLevel: z.number().int().min(1).max(12).optional(),
  homeroomTeacherId: z.string().uuid().optional(),
  academicYear: z.string().min(1).optional(),
});

export const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 siswa"),
});
