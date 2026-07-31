import "dotenv/config";
import { db } from "./index";
import { users, teacherProfiles } from "./schema";
import { eq } from "drizzle-orm";

async function check() {
  console.log("=== DEBUG: Checking teacher data ===\n");

  // 1. Check guru users
  const guruUsers = await db.select().from(users).where(eq(users.role, "GURU"));
  console.log(`Found ${guruUsers.length} GURU users:\n`);
  for (const u of guruUsers) {
    console.log(`  ID: ${u.id}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Phone: ${u.phone}`);
    console.log(`  Address: ${u.address}`);
    console.log("");
  }

  // 2. Check teacher profiles
  const profiles = await db.select().from(teacherProfiles);
  console.log(`Found ${profiles.length} teacher profiles:\n`);
  for (const tp of profiles) {
    console.log(`  Profile ID: ${tp.id}`);
    console.log(`  User ID: ${tp.userId}`);
    console.log(`  NIP: ${tp.nip}`);
    console.log(`  NIK: ${tp.nik}`);
    console.log(`  Gender: ${tp.gender}`);
    console.log(`  Birth Place: ${tp.birthPlace}`);
    console.log(`  Birth Date: ${tp.birthDate}`);
    console.log(`  Religion: ${tp.religion}`);
    console.log(`  Education: ${tp.education}`);
    console.log(`  Subject Area: ${JSON.stringify(tp.subjectArea)}`);
    console.log("");
  }

  // 3. Test the exact query used by the API
  if (guruUsers.length > 0) {
    const testUser = guruUsers[0];
    console.log(`=== Testing API query for user: ${testUser.name} (${testUser.id}) ===\n`);
    
    const tpResult = await db.query.teacherProfiles.findFirst({
      where: eq(teacherProfiles.userId, testUser.id),
    });
    
    console.log("teacherProfile result from db.query:", JSON.stringify(tpResult, null, 2));
  }

  process.exit(0);
}

check().catch(console.error);
