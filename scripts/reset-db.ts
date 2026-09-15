#!/usr/bin/env node
/**
 * ONE-TIME DB RESET SCRIPT
 * ========================
 * Run manually ONCE to wipe all tables and re-apply the schema from scratch.
 * Do NOT run this again after real demo data is loaded — it destroys everything.
 *
 * Usage:
 *   npm run db:reset
 *
 * What it does:
 *   1. Drops all existing tables in the Neon DB
 *   2. Re-pushes the Prisma schema (equivalent to a fresh migrate)
 *
 * This is safe to run once right now to clear leftover test data from earlier sessions.
 * After the hackathon demo is loaded, never run this again.
 */

import { execSync } from "child_process";

const run = (cmd: string) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

console.log("⚠️  ONE-TIME DB RESET — wiping all tables and re-pushing schema...\n");

try {
  // Use prisma db push --force-reset which drops all tables and re-creates them
  run("npx prisma db push --force-reset --accept-data-loss");
  console.log("\n✓ DB reset complete. Schema is fresh, all data cleared.");
  console.log("✓ Run `npx prisma studio` to verify the schema.");
  console.log("\nDO NOT run this script again after loading demo data.");
} catch (err) {
  console.error("\n✗ Reset failed:", err);
  process.exit(1);
}
