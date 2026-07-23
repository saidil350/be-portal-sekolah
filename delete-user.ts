import "dotenv/config";
import { db } from './src/db';
import { users, account, studentProfiles, sppInvoices, payments, attendanceRecords, notifications } from './src/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function deleteUser() {
  const userName = "Putra Aditya";
  
  console.log(`Mencari user dengan nama: ${userName}`);
  const foundUsers = await db.select().from(users).where(eq(users.name, userName)).execute();
  
  if (foundUsers.length === 0) {
    console.log("User tidak ditemukan.");
    process.exit(1);
  }

  for (const user of foundUsers) {
    console.log(`Menghapus data untuk user: ${user.name} (${user.id})`);

    // 1. Delete notifications
    await db.delete(notifications).where(eq(notifications.userId, user.id)).execute();
    console.log("  - Notifikasi dihapus.");

    // 2. Delete attendance
    await db.delete(attendanceRecords).where(eq(attendanceRecords.userId, user.id)).execute();
    console.log("  - Absensi dihapus.");

    // 3. Delete payments & invoices
    const invoices = await db.select({ id: sppInvoices.id }).from(sppInvoices).where(eq(sppInvoices.studentId, user.id)).execute();
    if (invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      await db.delete(payments).where(inArray(payments.invoiceId, invoiceIds)).execute();
      console.log("  - Payments dihapus.");
      await db.delete(sppInvoices).where(eq(sppInvoices.studentId, user.id)).execute();
      console.log("  - Invoices dihapus.");
    }

    // 4. Delete profiles
    await db.delete(studentProfiles).where(eq(studentProfiles.userId, user.id)).execute();
    console.log("  - Profil siswa dihapus.");

    // 5. Delete accounts and sessions
    const { session } = require('./src/db/schema');
    const { sql } = require('drizzle-orm');
    await db.delete(session).where(eq(session.userId, user.id)).execute();
    console.log("  - Sesi login dihapus.");

    await db.delete(account).where(eq(account.userId, user.id)).execute();
    console.log("  - Akun login dihapus.");

    await db.execute(sql`DELETE FROM "submissions" WHERE "student_id" = ${user.id}`);
    console.log("  - Submissions dihapus.");

    await db.execute(sql`DELETE FROM "class_enrollments" WHERE "student_id" = ${user.id}`);
    console.log("  - Class enrollments dihapus.");

    // 6. Delete user
    await db.delete(users).where(eq(users.id, user.id)).execute();
    console.log(`✅ User ${user.name} berhasil dihapus beserta seluruh datanya!`);
  }

  process.exit(0);
}

deleteUser().catch(console.error);
