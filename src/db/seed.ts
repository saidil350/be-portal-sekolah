import "dotenv/config";
import { db } from "./index";
import { tenants, users, account, studentProfiles, teacherProfiles, attendanceRecords, notifications } from "./schema";
import { hashPassword } from "@better-auth/utils/password";

const PASSWORD = "Password123";

async function main() {
  console.log("🌱 Memulai seeding database...");

  // Hash password using Better Auth's scrypt hasher
  const hashedPassword = await hashPassword(PASSWORD);

  // ─── 1. TENANTS ───
  console.log("📦 Creating tenants...");
  await db.insert(tenants).values([
    { name: "SMA Negeri 1 Jakarta", slug: "sman1jkt", domain: "sman1jkt.portalsekolah.id", address: "Jl. Budi Utomo No.7, Jakarta Pusat", phone: "021-34567890", isActive: true },
    { name: "SMP Kristen Yusuf", slug: "smpkyusuf", domain: "smpkyusuf.portalsekolah.id", address: "Jl. Yusuf No.12, Bandung", phone: "022-7654321", isActive: true },
    { name: "SD Al-Azhar Pusat", slug: "sdalazhar", domain: "sdalazhar.portalsekolah.id", address: "Jl. Sisingamangaraja, Jakarta Selatan", phone: "021-7890123", isActive: true },
    { name: "SMK Taruna Bhakti", slug: "smktaruna", domain: "smktaruna.portalsekolah.id", address: "Jl. Raya Taruna No.45, Surabaya", phone: "031-4567890", isActive: false },
    { name: "SMA Muhammadiyah 2", slug: "smamuhammadiyah2", domain: "smamuhammadiyah2.portalsekolah.id", address: "Jl. KH Ahmad Dahlan No.3, Yogyakarta", phone: "0274-567890", isActive: true },
  ]).onConflictDoNothing().returning();

  const allTenants = await db.select().from(tenants);
  const tenant1 = allTenants[0];

  // ─── 2. USERS ───
  console.log("👥 Creating users...");



  // Tenant 1 users
  await db.insert(users).values([
    { tenantId: tenant1.id, name: "Ahmad Fauzi", email: "admin.it@sekolah1.sch.id", password: hashedPassword, role: "ADMIN_IT", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Dr. Siti Rahayu", email: "kepsek@sekolah1.sch.id", password: hashedPassword, role: "KEPALA_SEKOLAH", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Budi Santoso", email: "guru.budi@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Siti Aminah, S.Pd", email: "siti.aminah@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Wahyu Nugroho", email: "wahyu.nugroho@sekolah1.sch.id", password: hashedPassword, role: "GURU", emailVerified: true, isActive: true },

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
  ]).onConflictDoNothing().returning();

  const tenant1Users = await db.select().from(users);

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
  ).onConflictDoNothing();

  // ─── 3. STUDENT PROFILES ───
  console.log("📋 Creating student profiles...");
  const nisPrefix = "2025";
  await db.insert(studentProfiles).values(
    students.map((s, i) => ({
      tenantId: tenant1.id,
      userId: s.id,
      nis: `${nisPrefix}${String(i + 1).padStart(4, "0")}`,
      nisn: `00${String(1000 + i)}`,
      gender: i % 2 === 0 ? "L" as const : "P" as const,
    }))
  );

  // ─── 4. TEACHER PROFILES ───
  console.log("👨‍🏫 Creating teacher profiles...");
  await db.insert(teacherProfiles).values([
    { tenantId: tenant1.id, userId: guru1.id, nip: "198501012010011001", gender: "L", subjectArea: ["Kimia", "Fisika"], isHomeroom: true },
    { tenantId: tenant1.id, userId: guru2.id, nip: "198702152011012002", gender: "P", subjectArea: ["Matematika"], isHomeroom: true },
    { tenantId: tenant1.id, userId: guru3.id, nip: "199003202012011003", gender: "L", subjectArea: ["Bahasa Indonesia", "IPS"], isHomeroom: true },
  ]);

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



  // ─── 10. NOTIFICATIONS ───
  console.log("🔔 Creating notifications...");
  const notifTypes = ["INFO", "SUCCESS", "WARNING", "ALERT", "ATTENDANCE"] as const;
  const notificationTemplates = [
    { title: "Selamat Datang!", message: "Akun Anda telah berhasil dibuat di Portal Sekolah.", type: "INFO" as const },
    { title: "Absensi Tercatat", message: "Absensi masuk Anda hari ini telah dicatat.", type: "ATTENDANCE" as const },
    { title: "Jadwal Ujian", message: "Jadwal ujian tengah semester telah dipublikasikan.", type: "INFO" as const },
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
  console.log(`Tenants:     ${allTenants.length}`);
  console.log(`Users:       ${tenant1Users.length} tenant users`);
  console.log(`Notifications: ~${notifData.length}`);
  console.log("─────────────────────────────────");
  console.log("\n🔑 Demo Login:");

  console.log("  ADMIN_IT:        admin.it@sekolah1.sch.id / Password123");
  console.log("  KEPALA_SEKOLAH:  kepsek@sekolah1.sch.id / Password123");
  console.log("  GURU:            guru.budi@sekolah1.sch.id / Password123");

  console.log("  SISWA:           siswa.putra@sekolah1.sch.id / Password123");
}

main().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exit(1);
});
