import "dotenv/config";
import { db } from "./index";
import { tenants, users, account, studentProfiles, teacherProfiles, attendanceRecords, notifications, sppInvoices, payments, sppTariffs, academicYears, studentClassHistory, classes } from "./schema";
import { hashPassword } from "@better-auth/utils/password";
import { eq, sql } from "drizzle-orm";

const PASSWORD = "Password123";

async function main() {
  console.log("🌱 Memulai seeding database...");

  // Ensure student_profiles & notifications columns exist
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

    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS target_role text;

    ALTER TABLE teacher_profiles
    ADD COLUMN IF NOT EXISTS birth_place text,
    ADD COLUMN IF NOT EXISTS birth_date date,
    ADD COLUMN IF NOT EXISTS nik text,
    ADD COLUMN IF NOT EXISTS religion text,
    ADD COLUMN IF NOT EXISTS education text;

    ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS academic_year_id uuid;

    CREATE TABLE IF NOT EXISTS academic_years (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id),
      name text NOT NULL,
      semester integer NOT NULL DEFAULT 1,
      is_current boolean NOT NULL DEFAULT false,
      start_date date,
      end_date date,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS student_class_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id),
      student_id uuid NOT NULL REFERENCES users(id),
      class_id uuid NOT NULL REFERENCES classes(id),
      academic_year_id uuid NOT NULL REFERENCES academic_years(id),
      status text NOT NULL DEFAULT 'PROMOTED',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
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



  // Tenant 1 users & global accounts
  await db.insert(users).values([
    { tenantId: tenant1.id, name: "Super Admin", email: "superadmin@portalsekolah.id", password: hashedPassword, role: "SUPER_ADMIN", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Ahmad Fauzi", email: "admin.it@sekolah1.sch.id", password: hashedPassword, role: "ADMIN_IT", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Dr. Siti Rahayu", email: "kepsek@sekolah1.sch.id", password: hashedPassword, role: "KEPALA_SEKOLAH", emailVerified: true, isActive: true },
    { tenantId: tenant1.id, name: "Dewi Kartika", email: "staff.keuangan@sekolah1.sch.id", password: hashedPassword, role: "STAFF", emailVerified: true, isActive: true },
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
    { tenantId: tenant1.id, name: "Test User", email: "test@test.com", password: hashedPassword, role: "SISWA", emailVerified: true, isActive: true },
  ]).onConflictDoNothing().returning();

  const tenant1Users = await db.select().from(users);

  const superAdmin = tenant1Users.find(u => u.role === "SUPER_ADMIN");
  const adminIt = tenant1Users.find(u => u.role === "ADMIN_IT");
  const kepsek = tenant1Users.find(u => u.role === "KEPALA_SEKOLAH");
  const staff1 = tenant1Users.find(u => u.role === "STAFF");
  const teachers = tenant1Users.filter(u => u.role === "GURU");
  const guru1 = teachers[0];
  const guru2 = teachers[1];
  const guru3 = teachers[2];
  const students = tenant1Users.filter((u) => u.role === "SISWA");

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
    "test@test.com": {
      phone: "0812-3456-7890",
      address: "Jl. Sudirman No. 88, Menteng, Jakarta Pusat",
      nik: "3171011503080099",
      birthPlace: "Jakarta",
      birthDate: "2008-03-15",
      gender: "L" as const,
      religion: "Islam",
      fatherName: "Budi Santoso",
      fatherOccupation: "Wiraswasta",
      motherName: "Siti Rahmawati",
      motherOccupation: "Ibu Rumah Tangga",
      guardianName: "Budi Santoso",
      guardianPhone: "0812-3456-7890",
    },
  };

  // ─── 3. CLASSES ───
  console.log("🏫 Creating classes...");
  let insertedClasses = await db.select().from(classes).where(eq(classes.tenantId, tenant1.id));
  if (insertedClasses.length === 0) {
    insertedClasses = await db.insert(classes).values([
      { tenantId: tenant1.id, name: "10 IPA 1", level: 10, program: "IPA", homeroomTeacherId: guru1.id },
      { tenantId: tenant1.id, name: "11 IPA 1", level: 11, program: "IPA", homeroomTeacherId: guru2.id },
      { tenantId: tenant1.id, name: "11 IPS 1", level: 11, program: "IPS", homeroomTeacherId: guru3.id },
      { tenantId: tenant1.id, name: "12 IPA 1", level: 12, program: "IPA", homeroomTeacherId: guru1.id },
    ]).returning();
  }
  const defaultClass = insertedClasses.find(c => c.level === 11) || insertedClasses[0];

  // ─── 4. STUDENT PROFILES ───
  console.log("📋 Creating student profiles for all students...");
  const allDbStudents = await db.select().from(users).where(eq(users.role, "SISWA"));
  const nisPrefix = "2025";

  for (let i = 0; i < allDbStudents.length; i++) {
    const s = allDbStudents[i];
    const details = studentMap[s.email] || {
      phone: s.phone || "0812-9876-5432",
      address: s.address || "Jl. Kebon Jeruk Raya No. 45, Jakarta",
      nik: `31740${String(100000000 + i + 1).slice(0, 11)}`,
      birthPlace: "Jakarta",
      birthDate: "2008-05-15",
      gender: i % 2 === 0 ? ("L" as const) : ("P" as const),
      religion: "Islam",
      fatherName: `Bambang ${s.name.split(" ")[0]}`,
      fatherOccupation: "Wiraswasta",
      motherName: `Dewi ${s.name.split(" ")[0]}`,
      motherOccupation: "Ibu Rumah Tangga",
      guardianName: `Bambang ${s.name.split(" ")[0]}`,
      guardianPhone: s.phone || "0812-9876-5432",
    };

    await db.update(users)
      .set({ 
        phone: s.phone || details.phone, 
        address: s.address || details.address 
      })
      .where(eq(users.id, s.id));

    const existing = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, s.id),
    });

    if (existing) {
      await db.update(studentProfiles)
        .set({
          classId: existing.classId || defaultClass.id,
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
        tenantId: s.tenantId,
        userId: s.id,
        classId: defaultClass.id,
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
  console.log("👨‍🏫 Creating & updating teacher profiles...");
  const teacherSeedData = [
    {
      user: guru1,
      nip: "198501012010011001",
      gender: "L",
      birthPlace: "Jakarta",
      birthDate: "1985-01-01",
      nik: "3174010101850001",
      religion: "Islam",
      education: "S1 - Sarjana Pendidikan",
      subjectArea: ["Kimia", "Fisika"],
      phone: "0812-3456-7890",
      address: "Jl. Margonda Raya No. 100, Depok",
    },
    {
      user: guru2,
      nip: "198702152011012002",
      gender: "P",
      birthPlace: "Bandung",
      birthDate: "1987-02-15",
      nik: "3174025502870002",
      religion: "Islam",
      education: "S2 - Magister Pendidikan",
      subjectArea: ["Matematika"],
      phone: "0813-8899-0011",
      address: "Jl. Pajajaran No. 42, Bandung",
    },
    {
      user: guru3,
      nip: "199003202012011003",
      gender: "L",
      birthPlace: "Surakarta",
      birthDate: "1990-03-20",
      nik: "3174032003900003",
      religion: "Islam",
      education: "S1 - Sarjana Pendidikan",
      subjectArea: ["Bahasa Indonesia", "IPS"],
      phone: "0856-7788-9900",
      address: "Jl. Slamet Riyadi No. 15, Surakarta",
    },
  ];

  await db.delete(teacherProfiles).where(eq(teacherProfiles.tenantId, tenant1.id));

  for (const item of teacherSeedData) {
    if (item.user) {
      await db.update(users)
        .set({ phone: item.phone, address: item.address })
        .where(eq(users.id, item.user.id));

      await db.insert(teacherProfiles).values({
        tenantId: tenant1.id,
        userId: item.user.id,
        nip: item.nip,
        gender: item.gender,
        birthPlace: item.birthPlace,
        birthDate: item.birthDate,
        nik: item.nik,
        religion: item.religion,
        education: item.education,
        subjectArea: item.subjectArea,
        isHomeroom: true,
      });
    }
  }

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
  console.log("💳 Creating SPP invoices and payments for all students...");
  
  // Bersihkan data lama agar tidak menumpuk saat re-seed
  await db.delete(payments);
  await db.delete(sppInvoices);

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const timeStr = (Date.now() + idx).toString().substring(7);

    // Mei 2026 (Bulan 5) - Lunas
    const invMei = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: student.id,
      invoiceNumber: `INV-202605-${student.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 5,
      year: 2026,
      status: "PAID",
      dueDate: new Date("2026-05-10"),
    }).returning();

    // Juni 2026 (Bulan 6) - Lunas
    const invJuni = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: student.id,
      invoiceNumber: `INV-202606-${student.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 6,
      year: 2026,
      status: "PAID",
      dueDate: new Date("2026-06-10"),
    }).returning();

    // Juli 2026 (Bulan 7 - Bulan Berjalan saat ini) - PENDING / Belum Lunas (beberapa PAID)
    const currentStatus = idx % 3 === 0 ? "PAID" : "PENDING";
    const invJuli = await db.insert(sppInvoices).values({
      tenantId: tenant1.id,
      studentId: student.id,
      invoiceNumber: `INV-202607-${student.id.substring(0, 4)}-${timeStr}`,
      amount: 500000,
      month: 7,
      year: 2026,
      status: currentStatus,
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

    if (currentStatus === "PAID") {
      await db.insert(payments).values({
        tenantId: tenant1.id,
        invoiceId: invJuli[0].id,
        paymentNumber: `PAY-202607-${timeStr}`,
        orderId: `SPP-${invJuli[0].id.substring(0, 8)}-3`,
        amount: 505000,
        paymentMethod: "qris",
        paymentType: "qris",
        status: "PAID",
        paidAt: new Date("2026-07-05"),
      });
    }
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

  // ─── 11. ACADEMIC YEARS & STUDENT CLASS HISTORY ───
  console.log("🎓 Creating academic years and student class history...");
  const [year1] = await db.insert(academicYears).values({
    tenantId: tenant1.id,
    name: "2024/2025",
    semester: 2,
    isCurrent: false,
  }).returning();

  const [year2] = await db.insert(academicYears).values({
    tenantId: tenant1.id,
    name: "2025/2026",
    semester: 1,
    isCurrent: true,
  }).returning();

  const studentUsers = tenant1Users.filter((u) => u.role === "SISWA");
  const allClasses = await db.select().from(classes).where(eq(classes.tenantId, tenant1.id));
  const class10 = allClasses.find((c) => c.level === 10) || allClasses[0];
  const class11 = allClasses.find((c) => c.level === 11) || allClasses[0];

  if (allClasses.length > 0) {
    for (const student of studentUsers) {
      // Record tahun ajaran lalu (naik kelas)
      await db.insert(studentClassHistory).values({
        tenantId: tenant1.id,
        studentId: student.id,
        classId: class10.id,
        academicYearId: year1.id,
        status: "PROMOTED",
      });

      // Record tahun ajaran aktif saat ini
      await db.insert(studentClassHistory).values({
        tenantId: tenant1.id,
        studentId: student.id,
        classId: class11.id,
        academicYearId: year2.id,
        status: "PROMOTED",
      });
    }
  }

  // ─── SUMMARY ───
  console.log("\n✅ Seeding selesai!");
  console.log("─────────────────────────────────");
  console.log(`Tenants:     ${allTenants.length}`);
  console.log(`Users:       ${tenant1Users.length} tenant users`);
  console.log(`Notifications: ~${notifData.length}`);
  console.log(`Class History: ${studentUsers.length * 2} records`);
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
