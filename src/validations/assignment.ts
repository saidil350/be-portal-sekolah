import { z } from "zod";

export const createAssignmentSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  classId: z.string().uuid(),
  teacherId: z.string().uuid(),
  dueDate: z.string(),
  maxScore: z.number().int().min(0),
  attachments: z.array(z.string()).optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  dueDate: z.string().optional(),
  maxScore: z.number().int().min(0).optional(),
  attachments: z.array(z.string()).optional(),
});

export const submitAssignmentSchema = z.object({
  attachments: z.array(z.string()).min(1, "Lampiran wajib diupload"),
  notes: z.string().optional(),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().optional(),
});
