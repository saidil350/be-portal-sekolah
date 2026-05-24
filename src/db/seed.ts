import "dotenv/config";
import { db } from "./index";
import { tenants, users, account, classes, classEnrollments, studentProfiles, teacherProfiles, attendanceRecords, assignments, submissions, invoices, payments, notifications } from "./schema";
import { hashPassword } from "@better-auth/utils/password";

const PASSWORD = "Password123";
const SPP_AMOUNT = "450000";

async function main() {
  console.log("🌱 Memulai seeding database...");

  // Hash password using Better Auth's scrypt hasher
  const hashedPassword = await hashPassword(PASSWORD);

  // ─── 1. TENANTS ───
  console.log("📦 Creating tenants...");
  const seededTenants = await db.insert(tenants).values([
    { name: "SMA Negeri 1 Jakarta", slug: "sman1jkt", domain: "sman1jkt.portalsekolah.id", address: "Jl. Budi Utomo No.7, Jakarta Pusat", phone: "021-34567890", isActive: true },
    { name: "SMP Kristen Yusuf", slug: "smpkyusuf", domain: "smpkyusuf.portalsekolah.id", address: "Jl. Yusuf No.12, Bandung", phone: "022-7654321", isActive: true },
    { name: "SD Al-Azhar Pusat", slug: "sdalazhar", domain: "sdalazhar.portalsekolah.id", address: "Jl. Sisingamangaraja, Jakarta Selatan", phone: "021-7890123", isActive: true },
    { name: "SMK Taruna Bhakti", slug: "smktaruna", domain: "smktaruna.portalsekolah.id", address: "Jl. Raya Taruna No.45, Surabaya", phone: "031-4567890", isActive: false },
    { name: "SMA Muhammadiyah 2", slug: "smamuhammadiyah2", domain: "smamuhammadiyah2.portalsekolah.id", address: "Jl. KH Ahmad Dahlan No.3, Yogyakarta", phone: "0274-567890", isActive: true },
  ]).returning();

  const tenant1 = seededTenants[0];

  // ─── 2. USERS ───
  console.log("👥 Creating users...");

  // SUPER_ADMIN (no tenant)
  const superAdmins = await db.insert(users).values([{
    tenantId: tenant1.id, name: "Super Admin", email: "superadmin@portalsekolah.id",
    password: hashedPassword, role: "SUPER_ADMIN", emailVerified: true, isActive: true,
  }]).returning();
  const superAdmin = superAdmins[0];

  // Tenant 1 users
  const tenant1Users = await db.insert(users).values([
    { tenantId: tenant1.id, name: "Ahmad Fauzi", email: "admin.it@sekolah1.sch.id", password: hashedPassword, role: "ADMIN_IT", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Dr. Siti Rahayu", email: "kepsek@sekolah1.sch.id", password: hashedPassword, role: "KEPALA_SEKOLAH", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Budi Santoso", email: "guru.budi@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Siti Aminah, S.Pd", email: "siti.aminah@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Wahyu Nugroho", email: "wahyu.nugroho@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Dewi Kartika", email: "staff.keuangan@sekolah1.sch.id", password: hashedPassword, role: "STAFF", emailVerified: true, isActive: true },
    // 10 Siswa
    { tenantId: tenant1.id, name: "Putra Aditya", email: "siswa.putra@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Adit Pratama", email: "adit.pratama@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Lulu Nurhaliza", email: "lulu.nurhaliza@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Rendra Setiawan", email: "rendra.setiawan@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Rian Hidayat", email: "rian.hidayat@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Maya Sari", email: "maya.sari@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Fajar Dwi", email: "fajar.dwi@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Nadia Putri", email: "nadia.putri@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Bayu Pratama", email: "bayu.pratama@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Lia Lestari", email: "lia.lestari@sekolah1.sch.id", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
  ]).returning();

  const adminIt = tenant1Users[0];
  const kepsek = tenant1Users[1];
  const guru1 = tenant1Users[2]; // Budi
  const guru2 = tenant1Users[3]; // Siti
  const guru3 = tenant1Users[4]; // Wahyu
  const staff1 = tenant1Users[5];
  const students = tenant1Users.slice(6); // 10 students

  // ─── 2b. ACCOUNT RECORDS (for Better Auth credential login) ───
  console.log("🔑 Creating account records for Better Auth...");
  const allUsers = [superAdmin, ...tenant1Users];
  const now = new Date();
  await db.insert(account).values(
    allUsers.map((u) => ({
      id: `cred_${u.id}`,
      accountId: u.email,
      providerId: "credential",
      userId: u.id,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // ─── 3. CLASSES ───
  console.log("🏫 Creating classes...");
  const seededClasses = await db.insert(classes).values([
    { tenantId: tenant1.id, name: "XI IPA 1", code: "XIIPA1", gradeLevel: 11, homeroomTeacherId: guru1.id, academicYear: "2025/2026" },
    { tenantId: tenant1.id, name: "XI IPA 2", code: "XIIPA2", gradeLevel: 11, homeroomTeacherId: guru2.id, academicYear: "2025/2026" },
    { tenantId: tenant1.id, name: "X IPS 1", code: "XIPS1", gradeLevel: 10, homeroomTeacherId: guru3.id, academicYear: "2025/2026" },
    { tenantId: tenant1.id, name: "XII IPA 1", code: "XIIIPA1", gradeLevel: 12, homeroomTeacherId: guru1.id, academicYear: "2025/2026" },
  ]).returning();

  const cls1 = seededClasses[0]; // XI IPA 1
  const cls2 = seededClasses[1]; // XI IPA 2
  const cls3 = seededClasses[2]; // X IPS 1
  const cls4 = seededClasses[3]; // XII IPA 1

  // ─── 4. STUDENT PROFILES ───
  console.log("📋 Creating student profiles...");
  const nisPrefix = "2025";
  await db.insert(studentProfiles).values(
    students.map((s, i) => ({
      tenantId: tenant1.id,
      userId: s.id,
      nis: `${nisPrefix}${String(i + 1).padStart(4, "0")}`,
      nisn: `00${String(1000 + i)}`,
      gender: i % 2 === 0 ? "L" as const : "P" as const,
      classId: [cls1.id, cls1.id, cls2.id, cls2.id, cls3.id, cls3.id, cls1.id, cls2.id, cls3.id, cls4.id][i],
    }))
  );

  // ─── 5. TEACHER PROFILES ───
  console.log("👨‍🏫 Creating teacher profiles...");
  await db.insert(teacherProfiles).values([
    { tenantId: tenant1.id, userId: guru1.id, nip: "198501012010011001", gender: "L", subjectArea: ["Kimia", "Fisika"], isHomeroom: true },
    { tenantId: tenant1.id, userId: guru2.id, nip: "198702152011012002", gender: "P", subjectArea: ["Matematika"], isHomeroom: true },
    { tenantId: tenant1.id, userId: guru3.id, nip: "199003202012011003", gender: "L", subjectArea: ["Bahasa Indonesia", "IPS"], isHomeroom: true },
  ]);

  // ─── 6. ENROLLMENTS ───
  console.log("📝 Creating enrollments...");
  await db.insert(classEnrollments).values(
    students.map((s, i) => ({
      classId: [cls1.id, cls1.id, cls2.id, cls2.id, cls3.id, cls3.id, cls1.id, cls2.id, cls3.id, cls4.id][i],
      studentId: s.id,
      academicYear: "2025/2026",
      status: "active",
    }))
  );

  // ─── 7. ATTENDANCE ───
  console.log("✅ Creating attendance records...");
  const statuses = ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "SICK", "ABSENT"];
  const attendanceData: any[] = [];
  for (let day = 0; day < 30; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekend
    for (const student of students) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const checkInHour = status === "LATE" ? 8 + Math.floor(Math.random() * 2) : 7;
      attendanceData.push({
        tenantId: tenant1.id,
        userId: student.id,
        date: date.toISOString().split("T")[0],
        checkInTime: status !== "ABSENT" ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), checkInHour, Math.floor(Math.random() * 30)) : null,
        checkOutTime: status !== "ABSENT" ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30)) : null,
        status,
        isRealtimeCheckedIn: Math.random() > 0.5,
      });
    }
  }
  // Insert in batches
  for (let i = 0; i < attendanceData.length; i += 50) {
    await db.insert(attendanceRecords).values(attendanceData.slice(i, i + 50));
  }

  // ─── 8. ASSIGNMENTS + SUBMISSIONS ───
  console.log("📚 Creating assignments and submissions...");
  const assignmentData = [
    { title: "Tugas 1: Eksperimen Kimia Organik", description: "Lakukan eksperimen kimia organik dan buat laporan", classId: cls2.id, teacherId: guru1.id, dueDate: new Date("2026-05-28"), maxScore: 100 },
    { title: "Ulangan Harian: Stoikiometri Larutan", description: "Ulangan harian materi stoikiometri larutan", classId: cls1.id, teacherId: guru1.id, dueDate: new Date("2026-05-25"), maxScore: 100 },
    { title: "Tugas Mandiri: Reaksi Redoks", description: "Buat ringkasan reaksi redoks", classId: cls2.id, teacherId: guru1.id, dueDate: new Date("2026-05-30"), maxScore: 100 },
    { title: "Tugas Matematika: Integral", description: "Kerjakan soal integral halaman 45-50", classId: cls1.id, teacherId: guru2.id, dueDate: new Date("2026-05-29"), maxScore: 100 },
    { title: "Kuis: Trigonometri", description: "Kuis singkat trigonometri", classId: cls2.id, teacherId: guru2.id, dueDate: new Date("2026-05-26"), maxScore: 50 },
    { title: "Essay: Sastra Indonesia Modern", description: "Buat essay tentang sastra Indonesia modern", classId: cls3.id, teacherId: guru3.id, dueDate: new Date("2026-06-01"), maxScore: 100 },
    { title: "Tugas IPS: Geografi Indonesia", description: "Buat peta konsep geografi Indonesia", classId: cls3.id, teacherId: guru3.id, dueDate: new Date("2026-05-27"), maxScore: 80 },
    { title: "Praktikum Fisika: Gelombang", description: "Praktikum gelombang di lab", classId: cls4.id, teacherId: guru1.id, dueDate: new Date("2026-06-03"), maxScore: 100 },
    { title: "Tugas Kelompok: Statistika", description: "Kerjakan tugas kelompok statistika", classId: cls1.id, teacherId: guru2.id, dueDate: new Date("2026-06-05"), maxScore: 100 },
  ];

  const seededAssignments = await db.insert(assignments).values(
    assignmentData.map((a) => ({ ...a, tenantId: tenant1.id, attachments: [] }))
  ).returning();

  // Submissions: each student submits to assignments in their class
  console.log("📝 Creating submissions...");
  const submissionData: any[] = [];
  let ungradedCount = 0;
  for (const assignment of seededAssignments) {
    // Get students in this class
    const classStudentIds = students.filter((_, i) =>
      [cls1.id, cls1.id, cls2.id, cls2.id, cls3.id, cls3.id, cls1.id, cls2.id, cls3.id, cls4.id][i] === assignment.classId
    );
    for (const student of classStudentIds) {
      const isGraded = Math.random() > 0.35; // ~65% graded
      const score = isGraded ? 60 + Math.floor(Math.random() * 40) : null;
      if (!isGraded) ungradedCount++;
      submissionData.push({
        tenantId: tenant1.id,
        assignmentId: assignment.id,
        studentId: student.id,
        attachments: [],
        notes: null,
        score,
        gradedBy: isGraded ? assignment.teacherId : null,
        gradedAt: isGraded ? new Date() : null,
        feedback: isGraded ? "Bagus, pertahankan!" : null,
      });
    }
  }
  for (let i = 0; i < submissionData.length; i += 50) {
    await db.insert(submissions).values(submissionData.slice(i, i + 50));
  }
  console.log(`  → ${ungradedCount} submissions ungraded`);

  // ─── 9. INVOICES + PAYMENTS ───
  console.log("💰 Creating invoices and payments...");
  const invoiceData: any[] = [];
  let invoiceCounter = 1;
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  for (const student of students) {
    for (const month of months) {
      const isPaid = month !== "2026-05" || Math.random() > 0.5;
      invoiceData.push({
        tenantId: tenant1.id,
        invoiceNumber: `SPP-${month}-${String(invoiceCounter++).padStart(4, "0")}`,
        studentId: student.id,
        amount: SPP_AMOUNT,
        dueDate: new Date(`${month}-15`),
        status: isPaid ? "PAID" : "UNPAID",
        description: `SPP Bulan ${month}`,
      });
    }
  }
  const seededInvoices = await db.insert(invoices).values(invoiceData).returning();

  // Payments for PAID invoices
  console.log("💳 Creating payments...");
  const paidInvoices = seededInvoices.filter((inv) => inv.status === "PAID");
  const paymentData = paidInvoices.map((inv) => ({
    tenantId: tenant1.id,
    invoiceId: inv.id,
    amount: inv.amount,
    paymentMethod: (Math.random() > 0.5 ? "QRIS" : "BANK_TRANSFER") as "QRIS" | "BANK_TRANSFER",
    paidAt: new Date(new Date(inv.dueDate).getTime() + Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)),
    referenceNumber: `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  }));
  for (let i = 0; i < paymentData.length; i += 50) {
    await db.insert(payments).values(paymentData.slice(i, i + 50));
  }

  // ─── 10. NOTIFICATIONS ───
  console.log("🔔 Creating notifications...");
  const notifTypes = ["INFO", "SUCCESS", "WARNING", "ALERT", "ATTENDANCE", "PAYMENT", "ASSIGNMENT"] as const;
  const notificationTemplates = [
    { title: "Selamat Datang!", message: "Akun Anda telah berhasil dibuat di Portal Sekolah.", type: "INFO" as const },
    { title: "Absensi Tercatat", message: "Absensi masuk Anda hari ini telah dicatat.", type: "ATTENDANCE" as const },
    { title: "Pembayaran Diterima", message: "Pembayaran SPP bulan ini telah diterima.", type: "PAYMENT" as const },
    { title: "Tugas Baru", message: "Guru telah memberikan tugas baru.", type: "ASSIGNMENT" as const },
    { title: "Jadwal Ujian", message: "Jadwal ujian tengah semester telah dipublikasikan.", type: "INFO" as const },
    { title: "Nilai Diumumkan", message: "Nilai tugas terakhir telah diumumkan.", type: "SUCCESS" as const },
    { title: "Tagihan SPP", message: "Tagihan SPP bulan ini belum dibayar.", type: "PAYMENT" as const },
    { title: "Pengumuman Sekolah", message: "Sekolah akan libur nasional minggu depan.", type: "ALERT" as const },
  ];
  const notifData: any[] = [];
  for (const user of tenant1Users) {
    const numNotifs = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numNotifs; i++) {
      const tpl = notificationTemplates[i % notificationTemplates.length];
      notifData.push({
        tenantId: tenant1.id,
        title: tpl.title,
        message: tpl.message,
        type: tpl.type,
        userId: user.id,
        isRead: Math.random() > 0.4,
        readAt: Math.random() > 0.4 ? new Date() : null,
        link: null,
      });
    }
  }
  for (let i = 0; i < notifData.length; i += 50) {
    await db.insert(notifications).values(notifData.slice(i, i + 50));
  }

  // ─── SUMMARY ───
  console.log("\n✅ Seeding selesai!");
  console.log("─────────────────────────────────");
  console.log(`Tenants:     ${seededTenants.length}`);
  console.log(`Users:       ${1 + tenant1Users.length} (1 SUPER_ADMIN + ${tenant1Users.length} tenant users)`);
  console.log(`Classes:     ${seededClasses.length}`);
  console.log(`Enrollments: ${students.length}`);
  console.log(`Attendance:  ~${attendanceData.length} records`);
  console.log(`Assignments: ${seededAssignments.length}`);
  console.log(`Submissions: ${submissionData.length} (${ungradedCount} ungraded)`);
  console.log(`Invoices:    ${invoiceData.length}`);
  console.log(`Payments:    ${paymentData.length}`);
  console.log(`Notifications: ~${notifData.length}`);
  console.log("─────────────────────────────────");
  console.log("\n🔑 Demo Login:");
  console.log("  SUPER_ADMIN:     superadmin@portalsekolah.id / Password123");
  console.log("  ADMIN_IT:        admin.it@sekolah1.sch.id / Password123");
  console.log("  KEPALA_SEKOLAH:  kepsek@sekolah1.sch.id / Password123");
  console.log("  GURU:            guru.budi@sekolah1.sch.id / Password123");
  console.log("  STAFF:           staff.keuangan@sekolah1.sch.id / Password123");
  console.log("  SISWA:           siswa.putra@sekolah1.sch.id / Password123");
}

main().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exit(1);
});
