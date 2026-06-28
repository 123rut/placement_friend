import { pool } from "./db";

async function main() {
  const result = await pool.query(
    "SELECT id, name, careers_url FROM companies WHERE status NOT IN ('paused', 'archived') ORDER BY name ASC"
  );
  console.log(`Active Companies (${result.rows.length}):`);
  for (const row of result.rows) {
    console.log(`- ${row.name} (${row.id}): ${row.careers_url}`);
  }
  await pool.end();
}

main().catch(console.error);
