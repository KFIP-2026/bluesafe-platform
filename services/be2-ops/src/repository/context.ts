import pg from "pg";
import type { AppRepository } from "./app-repository.js";
import { MemoryRepository } from "./memory-repository.js";
import { runMigrations } from "./migrate.js";
import { PostgresRepository } from "./postgres-repository.js";

const { Pool } = pg;

let repository: AppRepository | null = null;

export function getRepo(): AppRepository {
  if (!repository) {
    throw new Error("AppRepository not initialized; call initAppRepository() before handling requests");
  }
  return repository;
}

export async function initAppRepository(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const pool = new Pool({ connectionString: url });
    await runMigrations(pool);
    repository = new PostgresRepository(pool);
  } else {
    repository = new MemoryRepository();
  }
}
