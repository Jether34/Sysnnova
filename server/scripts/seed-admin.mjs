import { connectDb } from "../src/config/db.js";
import { seedAdmin, ADMIN_EMAIL } from "../src/services/seed-admin.js";

async function main() {
  await connectDb();
  const result = await seedAdmin();
  console.log(`[seed] admin ${result.created ? "created" : "verified"}. email=${ADMIN_EMAIL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
