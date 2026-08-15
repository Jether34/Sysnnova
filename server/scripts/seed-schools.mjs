import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "../src/config/db.js";
import School from "../src/models/School.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dataPath = path.join(__dirname, "data", "schools-public-jhs-shs.json");
  const records = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  console.log(`[seed] loading ${records.length} public JHS/SHS schools from ${path.basename(dataPath)}`);

  await connectDb();

  const before = await School.countDocuments();
  console.log(`[seed] existing schools in DB: ${before}`);

  const ops = records.map((r) => ({
    updateOne: {
      filter: { name: r.name, province: r.province, city: r.city, barangay: r.barangay },
      update: { $setOnInsert: r },
      upsert: true,
    },
  }));

  const batchSize = 500;
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < ops.length; i += batchSize) {
    const res = await School.bulkWrite(ops.slice(i, i + batchSize), { ordered: false });
    inserted += (res.upsertedCount || 0) + (res.insertedCount || 0);
    skipped += res.matchedCount || 0;
  }

  const after = await School.countDocuments();
  console.log(`[seed] done: ${inserted} inserted, ${skipped} already present, total now ${after}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
