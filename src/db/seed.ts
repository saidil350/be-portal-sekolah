import "dotenv/config";
import { db } from "./index";
import { tenants, users, account, studentProfiles, teacherProfiles, attendanceRecords, notifications, sppInvoices, payments, sppTariffs } from "./schema";
import { hashPassword } from "@better-auth/utils/password";
import { eq, sql } from "drizzle-orm";

const PASSWORD = "Password123";

async function main() {
  console.log("🌱 Memulai seeding database...");

  // Ensure student_profiles columns exist
  await db.execute(sql`
    ALTER TABLE student_profiles 
    ADD COLUMN IF NOT EXISTS nik text,
    ADD COLUMN IF NOT EXISTS religion text,
    ADD COLUMN IF NOT EXISTS father_name text,
    ADD COLUMN IF NOT EXISTS father_occupation text,
    ADD COLUMN IF NOT EXISTS mother_name text,
    ADD COLUMN IF NOT EXISTS mother_occupation text,
    ADD COLUMN IF NOT EXISTS guardian_name text,
    ADD COLUMN IF NOT EXISTS guardian_phone text;
  `);

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
    { tenantId: tenant1.id, name: "Putra Aditya", email: "siswa.putra@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0812-9876-5432", address: "Jl. Kebon Jeruk Raya No. 45, Kebayoran Lama, Jakarta Selatan", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Adit Pratama", email: "adit.pratama@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0857-1122-3344", address: "Jl. Budi Utomo No. 12, Menteng, Jakarta Pusat", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Lulu Nurhaliza", email: "lulu.nurhaliza@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0813-4455-6677", address: "Jl. Tebet Barat Dalam No. 8, Tebet, Jakarta Selatan", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Rendra Setiawan", email: "rendra.setiawan@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0818-7788-9900", address: "Jl. Kemang Raya No. 15, Mampang Prapatan, Jakarta Selatan", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Rian Hidayat", email: "rian.hidayat@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0821-3344-5566", address: "Jl. Palmerah Barat No. 27, Palmerah, Jakarta Barat", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Maya Sari", email: "maya.sari@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0852-6677-8899", address: "Jl. Senopati No. 50, Kebayoran Baru, Jakarta Selatan", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Fajar Dwi", email: "fajar.dwi@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0878-9900-1122", address: "Jl. Mangga Dua Raya No. 10, Sawah Besar, Jakarta Pusat", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Nadia Putri", email: "nadia.putri@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0819-2233-4455", address: "Jl. Cikini Raya No. 33, Menteng, Jakarta Pusat", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Bayu Pratama", email: "bayu.pratama@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0838-5566-7788", address: "Jl. Gajah Mada No. 100, Taman Sari, Jakarta Barat", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Lia Lestari", email: "lia.lestari@sekolah1.sch.id", password: hashedPassword, role: "SISWA", phone: "0811-6677-8899", address: "Jl. Prapanca Raya No. 20, Kebayoran Baru, Jakarta Selatan", emailVerified: true, isActive: true },
  ]).onConflictDoNothing().returning();

  const tenant1Users = await db.select().from(users);

  const adminIt = tenant1Users[0];
  const kepsek = tenant1Users[1];
  const guru1 = tenant1Users[2]; // Budi
  const guru2 = tenant1Users[3]; // Siti
  const guru3 = tenant1Users[4]; // Wahyu
  const staff1 = tenant1Users[5];
  const students = tenant1Users.filter((u) => u.role === "SISWA"); // All 10 students

  // Map student email directly to dummy profile details to ensure accurate assignment
  const studentMap: Record<string, any> = {
    "siswa.putra@sekolah1.sch.id": {
      phone: "0812-9876-5432",
      address: "Jl. Kebon Jeruk Raya No. 45, Kebayoran Lama, Jakarta Selatan",
      nik: "3174011505080001",
      birthPlace: "Jakarta",
      birthDate: "2008-05-15",
      gender: "L" as const,
      religion: "Islam",
      fatherName: "Bambang Aditya",
      fatherOccupation: "Wiraswasta",
      motherName: "Dewi Rahmawati",
      motherOccupation: "Ibu Rumah Tangga",
      guardianName: "Bambang Aditya",
      guardianPhone: "0812-9876-5432",
    },
    "adit.pratama@sekolah1.sch.id": {
      phone: "0857-1122-3344",
      address: "Jl. Budi Utomo No. 12, Menteng, Jakarta Pusat",
      nik: "3171021008080002",
      birthPlace: "Jakarta",
      birthDate: "2008-08-10",
      gender: "L" as const,
      religion: "Islam",
      fatherName: "Hendra Pratama",
      fatherOccupation: "Pegawai Negeri Sipil (PNS)",
      motherName: "Siti Aminah",
      motherOccupation: "Guru",
      guardianName: "Hendra Pratama",
      guardianPhone: "0857-1122-3344",
    },
    "lulu.nurhaliza@sekolah1.sch.id": {
      phone: "0813-4455-6677",
      address: "Jl. Tebet Barat Dalam No. 8, Tebet, Jakarta Selatan",
      nik: "3174042211080003",
      birthPlace: "Bandung",
      birthDate: "2008-11-22",
      gender: "P" as const,
      religion: "Islam",
      fatherName: "Ahmad Hidayat",
      fatherOccupation: "Arsitek",
      motherName: "Rina Nurhaliza",
      motherOccupation: "Karyawan Swasta",
      guardianName: "Ahmad Hidayat",
      guardianPhone: "0813-4455-6677",
    },
    "rendra.setiawan@sekolah1.sch.id": {
      phone: "0818-7788-9900",
      address: "Jl. Kemang Raya No. 15, Mampang Prapatan, Jakarta Selatan",
      nik: "3174030503080004",
      birthPlace: "Surabaya",
      birthDate: "2008-03-05",
      gender: "L" as const,
      religion: "Kristen",
      fatherName: "Dedi Setiawan",
      fatherOccupation: "Pengusaha",
      motherName: "Maria Susanti",
      motherOccupation: "Dokter",
      guardianName: "Dedi Setiawan",
      guardianPhone: "0818-7788-9900",
    },
    "rian.hidayat@sekolah1.sch.id": {
      phone: "0821-3344-5566",
      address: "Jl. Palmerah Barat No. 27, Palmerah, Jakarta Barat",
      nik: "3173051407080005",
      birthPlace: "Bogor",
      birthDate: "2008-07-14",
      gender: "L" as const,
      religion: "Islam",
      fatherName: "Syaiful Hidayat",
      fatherOccupation: "TNI",
      motherName: "Kartika Indah",
      motherOccupation: "Ibu Rumah Tangga",
      guardianName: "Syaiful Hidayat",
      guardianPhone: "0821-3344-5566",
    },
    "maya.sari@sekolah1.sch.id": {
      phone: "0852-6677-8899",
      address: "Jl. Senopati No. 50, Kebayoran Baru, Jakarta Selatan",
      nik: "3174011809080006",
      birthPlace: "Medan",
      birthDate: "2008-09-18",
      gender: "P" as const,
      religion: "Islam",
      fatherName: "Rudi Kusuma",
      fatherOccupation: "Wiraswasta",
      motherName: "Lestari Sari",
      motherOccupation: "Desainer Grafis",
      guardianName: "Rudi Kusuma",
      guardianPhone: "0852-6677-8899",
    },
    "fajar.dwi@sekolah1.sch.id": {
      phone: "0878-9900-1122",
      address: "Jl. Mangga Dua Raya No. 10, Sawah Besar, Jakarta Pusat",
      nik: "3171030202080007",
      birthPlace: "Semarang",
      birthDate: "2008-02-02",
      gender: "L" as const,
      religion: "Hindu",
      fatherName: "I Wayan Dwi",
      fatherOccupation: "Dosen",
      motherName: "Ni Luh Ratna",
      motherOccupation: "PNS",
      guardianName: "I Wayan Dwi",
      guardianPhone: "0878-9900-1122",
    },
    "nadia.putri@sekolah1.sch.id": {
      phone: "0819-2233-4455",
      address: "Jl. Cikini Raya No. 33, Menteng, Jakarta Pusat",
      nik: "3171022512080008",
      birthPlace: "Yogyakarta",
      birthDate: "2008-12-25",
      gender: "P" as const,
      religion: "Katolik",
      fatherName: "Antonius Putri",
      fatherOccupation: "Pengacara",
      motherName: "Elisabeth Ningsih",
      motherOccupation: "Apoteker",
      guardianName: "Antonius Putri",
      guardianPhone: "0819-2233-4455",
    },
    "bayu.pratama@sekolah1.sch.id": {
      phone: "0838-5566-7788",
      address: "Jl. Gajah Mada No. 100, Taman Sari, Jakarta Barat",
      nik: "3173010404080009",
      birthPlace: "Malang",
      birthDate: "2008-04-04",
      gender: "L" as const,
      religion: "Buddha",
      fatherName: "Surya Pratama",
      fatherOccupation: "Manager IT",
      motherName: "Yenny Indrawati",
      motherOccupation: "Wiraswasta",
      guardianName: "Surya Pratama",
      guardianPhone: "0838-5566-7788",
    },
    "lia.lestari@sekolah1.sch.id": {
      phone: "0811-6677-8899",
      address: "Jl. Prapanca Raya No. 20, Kebayoran Baru, Jakarta Selatan",
      nik: "3174013006080010",
      birthPlace: "Solo",
      birthDate: "2008-06-30",
      gender: "P" as const,
      religion: "Islam",
      fatherName: "Agus Lestari",
      fatherOccupation: "Wiraswasta",
      motherName: "Sri Wahyuni",
      motherOccupation: "Bidan",
      guardianName: "Agus Lestari",
      guardianPhone: "0811-6677-8899",
    },
  };

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const details = studentMap[s.email] || studentMap["siswa.putra@sekolah1.sch.id"];
    await db.update(users)
      .set({ phone: details.phone, address: details.address })
      .where(eq(users.id, s.id));
  }

  // ─── 2b. ACCOUNT RECORDS (for Better Auth credential login) ───
  console.log("🔑 Creating account records for Better Auth...");
  const allUsers = [...tenant1Users];
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

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const details = studentMap[s.email] || studentMap["siswa.putra@sekolah1.sch.id"];
    
    const existing = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, s.id),
    });

    if (existing) {
      await db.update(studentProfiles)
        .set({
          gender: details.gender,
          birthPlace: details.birthPlace,
          birthDate: details.birthDate,
          nik: details.nik,
          religion: details.religion,
          fatherName: details.fatherName,
          fatherOccupation: details.fatherOccupation,
          motherName: details.motherName,
          motherOccupation: details.motherOccupation,
          guardianName: details.guardianName,
          guardianPhone: details.guardianPhone,
        })
        .where(eq(studentProfiles.userId, s.id));
    } else {
      await db.insert(studentProfiles).values({
        tenantId: tenant1.id,
        userId: s.id,
        nis: `${nisPrefix}${String(i + 1).padStart(4, "0")}`,
        nisn: `00${String(1000 + i)}`,
        gender: details.gender,
        birthPlace: details.birthPlace,
        birthDate: details.birthDate,
        nik: details.nik,
        religion: details.religion,
        fatherName: details.fatherName,
        fatherOccupation: details.fatherOccupation,
        motherName: details.motherName,
        motherOccupation: details.motherOccupation,
        guardianName: details.guardianName,
        guardianPhone: details.guardianPhone,
      });
    }
  }

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



  // ─── 8. SPP INVOICES & PAYMENTS ───
  console.log("💳 Creating SPP invoices and payments...");
  
  // Bersihkan data lama agar tidak menumpuk saat re-seed
  await db.delete(payments);
  await db.delete(sppInvoices);

  const putraAditya = students[0]; // Putra Aditya
  
  if (putraAditya) {
    const timeStr = Date.now().toString().substring(7);

    // Mei 2026 (Bulan 5) - Lunas
    const invMei = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: putraAditya.id,
      invoiceNumber: `INV-202605-${putraAditya.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 5,
      year: 2026,
      status: "PAID",
      dueDate: new Date("2026-05-10"),
    }).returning();

    // Juni 2026 (Bulan 6) - Lunas
    const invJuni = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: putraAditya.id,
      invoiceNumber: `INV-202606-${putraAditya.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 6,
      year: 2026,
      status: "PAID",
      dueDate: new Date("2026-06-10"),
    }).returning();

    // Juli 2026 (Bulan 7 - Bulan Berjalan saat ini) - PENDING / Belum Lunas
    const invJuli = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: putraAditya.id,
      invoiceNumber: `INV-202607-${putraAditya.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 7,
      year: 2026,
      status: "PENDING",
      dueDate: new Date("2026-07-10"),
    }).returning();

    // Transaksi Pembayaran untuk tagihan yang LUNAS
    await db.insert(payments).values([
      {
        tenantId: tenant1.id,
        invoiceId: invMei[0].id,
        paymentNumber: `PAY-202605-${timeStr}`,
        orderId: `SPP-${invMei[0].id.substring(0, 8)}-1`,
        amount: 505000,
        paymentMethod: "gopay",
        paymentType: "qris",
        status: "PAID",
        paidAt: new Date("2026-05-05"),
      },
      {
        tenantId: tenant1.id,
        invoiceId: invJuni[0].id,
        paymentNumber: `PAY-202606-${timeStr}`,
        orderId: `SPP-${invJuni[0].id.substring(0, 8)}-2`,
        amount: 505000,
        paymentMethod: "bank_transfer",
        paymentType: "bca_va",
        status: "PAID",
        paidAt: new Date("2026-06-08"),
      },
    ]);
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
