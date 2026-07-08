import pg from "pg";
import { seedCompanies } from "../../packages/domain/src/companies.js";

const connectionString = "postgresql://postgres.kogehuzrradxhehyhzsn:5n7H%nrLM.ecbUK@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const existingIds = new Set(seedCompanies.map(c => c.id));
    const res = await pool.query(
      `SELECT * FROM companies WHERE ats IS NOT NULL ORDER BY name`
    );
    const newCompanies = res.rows.filter(c => !existingIds.has(c.id));
    
    console.log(`\nFound ${newCompanies.length} new companies with ATS adapters to add to code:`);
    console.log("==========================================");
    const output = newCompanies.map(c => {
      let branches = ["Computer Science", "Information Technology"];
      if (c.eligible_branches) {
        branches = c.eligible_branches.split(",").map(b => b.trim()).filter(Boolean);
      }
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        careersUrl: c.careers_url,
        category: c.category,
        eligibleBranches: branches,
        minCgpa: c.min_cgpa ? parseFloat(c.min_cgpa) : null,
        avgPackageLpa: c.avg_package ? parseFloat(c.avg_package) : null,
        source: c.source,
        urlVerifiedAt: c.url_verified_at ? c.url_verified_at.toISOString() : null,
        isActive: c.is_active,
        ats: c.ats,
        identifier: c.identifier,
        site: c.site,
        host: c.ats_host,
        industry: c.industry || "Technology",
        city: c.city || "Bengaluru",
        country: c.country || "IN"
      };
    });
    console.log(JSON.stringify(output, null, 2));
    console.log("==========================================");
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

main();
