import "dotenv/config";
import { db } from "./src/db/index.js";
import { users, account, session, verification, tenants } from "./src/db/schema.js";
import { sql, inArray } from "drizzle-orm";

async function runAudit() {
  const prodUrl = process.env.DATABASE_URL;

  console.log("=================================");
  console.log("STEP 1: VERIFY DATABASE CONNECTION");
  console.log("=================================");
  
  let connInfo: any = {};
  try {
    const connRes = await db.execute(sql`
      SELECT 
        current_database() as current_db,
        current_schema() as current_schema,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as pg_version;
    `);
    connInfo = connRes.rows[0];
    console.log("Active Connection Info:", connInfo);
  } catch (err: any) {
    console.error("Error querying conn info:", err.message);
  }

  const rawConnStr = process.env.DATABASE_URL || "";
  let host = "Unknown", dbName = "Unknown", ssl = "Not specified", branch = "Unknown";
  try {
    const url = new URL(rawConnStr);
    host = url.hostname;
    dbName = url.pathname.replace("/", "");
    ssl = url.searchParams.get("sslmode") || "Not set";
    if (host.includes(".neon.tech")) {
      const match = host.match(/^([^-]+(-[^-]+)*)-pooler\./) || host.match(/^([^-]+(-[^-]+)*)\./);
      branch = match ? match[1] : "Unknown";
    }
  } catch (e) {}

  console.log("Parsed Connection String:", {
    host,
    dbName,
    sslConfig: ssl,
    neonBranchEndpoint: branch,
  });

  console.log("\n=================================");
  console.log("STEP 2: VERIFY DATABASE STRUCTURE");
  console.log("=================================");
  
  const tablesRes = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  const existingTables = tablesRes.rows.map((r: any) => r.table_name);
  console.log("Existing Tables in public schema:", existingTables);

  const targetTables = ['users', 'account', 'session', 'verification', 'tenant', 'tenants', 'roles', 'permissions', 'user_roles'];
  const tableCheckStatus: Record<string, boolean> = {};
  targetTables.forEach(t => {
    tableCheckStatus[t] = existingTables.includes(t);
  });
  console.log("Target Table Verification Status:", tableCheckStatus);

  console.log("\n=================================");
  console.log("STEP 3: VERIFY MIGRATIONS");
  console.log("=================================");
  
  let executedMigrations: any[] = [];
  try {
    const migRes = await db.execute(sql`SELECT * FROM __drizzle_migrations ORDER BY created_at ASC;`);
    executedMigrations = migRes.rows;
    console.log("Executed Migrations count:", executedMigrations.length);
    console.log("Executed Migrations details:", executedMigrations);
  } catch (e: any) {
    console.log("No __drizzle_migrations table found in DB.");
  }

  console.log("\n=================================");
  console.log("STEP 4: VERIFY AUTHENTICATION DATA");
  console.log("=================================");
  
  const getCount = async (tableName: string) => {
    if (!existingTables.includes(tableName)) return "TABLE NOT FOUND";
    try {
      const res = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM "${tableName}"`));
      return (res.rows[0] as any).cnt;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  };

  const counts: Record<string, any> = {};
  for (const t of ['users', 'account', 'session', 'verification', 'tenants', 'roles', 'permissions', 'user_roles']) {
    counts[t] = await getCount(t);
  }
  console.log("Table Row Counts:", counts);

  console.log("\n=================================");
  console.log("STEP 5: VERIFY DEFAULT USERS");
  console.log("=================================");
  
  const targetEmails = [
    'admin.it@sekolah1.sch.id',
    'kepsek@sekolah1.sch.id',
    'guru.budi@sekolah1.sch.id',
    'siswa.putra@sekolah1.sch.id'
  ];

  let foundUsers: any[] = [];
  if (existingTables.includes('users')) {
    foundUsers = await db.select().from(users).where(inArray(users.email, targetEmails));
  }
  console.log("Found Target Users Count:", foundUsers.length);
  console.log("Found Target Users:", foundUsers.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));

  console.log("\n=================================");
  console.log("STEP 6: VERIFY ACCOUNT LINK");
  console.log("=================================");
  
  let accountsData: any[] = [];
  if (existingTables.includes('account')) {
    accountsData = await db.select().from(account);
    console.log("Total accounts in 'account' table:", accountsData.length);
  }

  const userAccMapping = foundUsers.map(u => {
    const acc = accountsData.filter(a => a.userId === u.id);
    return {
      userId: u.id,
      email: u.email,
      hasAccount: acc.length > 0,
      accountProviders: acc.map(a => a.providerId),
      accountDetails: acc.map(a => ({ id: a.id, accountId: a.accountId, passwordLength: a.password ? a.password.length : 0 }))
    };
  });
  console.log("User-Account Mapping:", JSON.stringify(userAccMapping, null, 2));

  if (existingTables.includes('account') && existingTables.includes('users')) {
    const orphans = await db.execute(sql`
      SELECT a.id, a.user_id, a.provider_id 
      FROM account a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE u.id IS NULL;
    `);
    console.log("Orphan accounts count:", orphans.rows.length);
  }

  console.log("\n=================================");
  console.log("STEP 7: VERIFY PASSWORD HASH");
  console.log("=================================");
  
  foundUsers.forEach(u => {
    const accs = accountsData.filter(a => a.userId === u.id);
    if (accs.length === 0) {
      console.log(`User ${u.email}: NO ACCOUNT RECORD`);
    }
    accs.forEach(a => {
      let passStatus = "No password field / empty";
      let hashAlgo = "Unknown";
      if (a.password) {
        const pass = a.password;
        if (pass.startsWith("$2a$") || pass.startsWith("$2b$") || pass.startsWith("$2y$")) {
          passStatus = "Properly hashed";
          hashAlgo = "bcrypt";
        } else if (pass.startsWith("$argon2id$") || pass.startsWith("$argon2i$")) {
          passStatus = "Properly hashed";
          hashAlgo = "argon2";
        } else if (pass.startsWith("pbkdf2$") || pass.startsWith("$scrypt$")) {
          passStatus = "Properly hashed";
          hashAlgo = "pbkdf2/scrypt";
        } else if (pass.startsWith("scrypt$") || pass.includes(":")) {
          passStatus = "Properly hashed";
          hashAlgo = "scrypt (Better Auth default)";
        } else if (pass.length === 64 || pass.length === 32) {
          passStatus = "Possible raw hash (SHA256/MD5)";
        } else if (pass.length < 20) {
          passStatus = "PLAIN TEXT OR INSECURE";
        } else {
          passStatus = `Hashed format (length=${pass.length})`;
          hashAlgo = "scrypt / Better Auth Hash";
        }
      }
      console.log(`User ${u.email}: status="${passStatus}", algo="${hashAlgo}", samplePrefix="${a.password ? a.password.substring(0, 20) : 'N/A'}"`);
    });
  });

  process.exit(0);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
