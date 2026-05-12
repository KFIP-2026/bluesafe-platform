import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

export async function runMigrations(pool: Pool): Promise<void> {
  const dir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const sql = readFileSync(join(dir, name), "utf8");
    await pool.query(sql);
  }
}
