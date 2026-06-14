import { NextResponse } from "next/server";
import { pool } from "../../../../worker/src/db";
import {
  validateUrl,
  checkDuplicateUrl,
  fuzzyMatchCompany,
  detectSingleListingUrl,
  detectRegionMismatch
} from "../../../../worker/src/validator";

/**
 * GET /api/companies
 * Fetch list of companies with pagination, search, and status filters.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    let query = "SELECT * FROM companies";
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    } else {
      // Hide archived by default
      conditions.push(`status <> 'archived'`);
    }

    if (search) {
      conditions.push(`name ILIKE $${params.length + 1}`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Count query
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS sub`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Pagination query
    query += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);

    const res = await pool.query(query, params);

    const data = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      careersUrl: row.careers_url,
      status: row.status,
      fail_count: row.fail_count,
      silent_fail_count: row.silent_fail_count,
      last_scraped_at: row.last_scraped_at,
      last_checked_at: row.last_checked_at,
      last_failure_reason: row.last_failure_reason,
      opportunities_found_last_run: row.opportunities_found_last_run,
      url_confirmed_by_user: row.url_confirmed_by_user,
      previous_careers_url: row.previous_careers_url,
      region: row.region,
      added_by: row.added_by
    }));

    return NextResponse.json({
      data,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("GET companies error:", error);
    return NextResponse.json({ error: "server_error", message: error.message }, { status: 500 });
  }
}

/**
 * POST /api/companies
 * Add a new company, running format, deduplication, and fuzzy match checks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, careersUrl, region, confirmOverride } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "invalid_name", message: "Company name is required." }, { status: 400 });
    }

    const companyRegion = region || "IN";

    // 1. Fuzzy Match checks
    if (!confirmOverride) {
      const fuzzy = await fuzzyMatchCompany(name);
      if (fuzzy.level === "conflict") {
        return NextResponse.json({
          conflict: "name_match",
          match: fuzzy.match
        });
      } else if (fuzzy.level === "warning") {
        return NextResponse.json({
          conflict: "possible_match",
          match: fuzzy.match,
          suggestion: `Did you mean "${fuzzy.match?.name}"?`
        });
      }
    }

    let statusVal = "active";

    if (careersUrl && careersUrl.trim() !== "") {
      // URL format check
      try {
        const parsed = new URL(careersUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "invalid_url", message: "Only HTTP/HTTPS URLs are allowed." }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "invalid_url", message: "Invalid URL format." }, { status: 400 });
      }

      // Single listing URL check
      if (!confirmOverride && detectSingleListingUrl(careersUrl)) {
        return NextResponse.json({
          error: "single_listing_url",
          message: "Looks like a single listing, not a careers page."
        }, { status: 422 });
      }

      // Duplicate URL check
      if (!confirmOverride) {
        const dup = await checkDuplicateUrl(careersUrl);
        if (dup.duplicate) {
          return NextResponse.json({
            conflict: "duplicate_url",
            existingCompany: dup.existingCompany
          });
        }
      }

      // URL page load and keyword scan check
      if (!confirmOverride) {
        const validation = await validateUrl(careersUrl);
        if (validation.warning === "not_careers_page") {
          return NextResponse.json({
            warning: "not_careers_page",
            url: careersUrl,
            confirmToken: "confirm"
          });
        }
      }
    } else {
      statusVal = "url_missing";
    }

    // Check region mismatch
    let regionWarning = null;
    if (careersUrl) {
      regionWarning = detectRegionMismatch(careersUrl, companyRegion);
    }

    // Generate deterministic slug
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = id;

    // Use default values for required DB columns
    const category = "it-product";
    const eligibleBranches = "Computer Science, Information Technology, Electronics";
    const source = "user-added";

    const insertQuery = `
      INSERT INTO companies (
        id, name, slug, careers_url, category, eligible_branches, 
        source, status, region, added_by, is_active, is_global, url_confirmed_by_user
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const res = await pool.query(insertQuery, [
      id,
      name,
      slug,
      careersUrl || null,
      category,
      eligibleBranches,
      source,
      statusVal,
      companyRegion,
      "user",
      statusVal === "active",
      true,
      confirmOverride ? true : false
    ]);

    const row = res.rows[0];
    const responseBody: any = {
      id: row.id,
      name: row.name,
      status: row.status,
      careersUrl: row.careers_url,
      region: row.region
    };

    if (regionWarning) {
      responseBody.warning = "region_mismatch";
      responseBody.message = regionWarning;
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error: any) {
    console.error("POST company error:", error);
    return NextResponse.json({ error: "server_error", message: error.message }, { status: 500 });
  }
}
