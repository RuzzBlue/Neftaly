import { Client } from "pg";
import { readFile } from "node:fs/promises";

const db = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await db.connect();
  await db.query(
    await readFile(new URL("../neon/001_schema.sql", import.meta.url), "utf8"),
  );
  console.log("Neon schema migration completed.");
} finally {
  await db.end();
}
