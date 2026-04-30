import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { JSONFilePreset } from "lowdb/node";
import type { OffchainDatabase } from "@/offchain/schemas";

const databasePath =
  process.env.LOCAL_DB_PATH ??
  path.join(process.cwd(), "offchain-db", "db.json");

let dbPromise: ReturnType<typeof createDatabase> | undefined;

async function createDatabase() {
  await mkdir(path.dirname(databasePath), { recursive: true });

  return JSONFilePreset<OffchainDatabase>(databasePath, {
    properties: [],
  });
}

export function getDb() {
  dbPromise ??= createDatabase();

  return dbPromise;
}
