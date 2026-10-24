import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";

const db = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await db.connect();
  const directory = new URL("../neon/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.query(await readFile(new URL(file, directory), "utf8"));
    console.log(`Applied ${file}`);
  }
  console.log("Neon schema migration completed.");
} finally {
  await db.end();
}
