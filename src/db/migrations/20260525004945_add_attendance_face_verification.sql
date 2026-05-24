ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "selfie_url" text,
  ADD COLUMN IF NOT EXISTS "face_verified" boolean DEFAULT false;
