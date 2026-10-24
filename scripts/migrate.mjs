import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";

const db = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await db.connect();
  await db.query("BEGIN");
  const directory = new URL("../neon/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const source = await readFile(new URL(file, directory), "utf8");
    await db.query(
      source.replace(/^BEGIN;\r?$/m, "").replace(/^COMMIT;\r?$/m, ""),
    );
    console.log(`Applied ${file}`);
  }
  await db.query("COMMIT");
  console.log("Neon schema migration completed.");
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
