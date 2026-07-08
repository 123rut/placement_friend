import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { DB_POOL } from "../db/db.module";
import {
  validateUrl,
  checkDuplicateUrl,
  fuzzyMatchCompany,
  detectRegionMismatch,
  detectSingleListingUrl,
  detectRedirect
} from "@piaa/domain";

@Injectable()
export class CompaniesService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async getCompanies(page: number, limit: number, search: string, status: string) {
    let query = "SELECT * FROM companies";
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    } else {
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
    const countRes = await this.pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Pagination query
    query += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);

    const res = await this.pool.query(query, params);

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

    return {
      data,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async createCompany(body: { name: string; careersUrl?: string; region?: string; confirmOverride?: boolean }) {
    const { name, careersUrl, region, confirmOverride } = body;

    if (!name || name.trim() === "") {
      return {
        status: 400,
        data: { error: "invalid_name", message: "Company name is required." }
      };
    }

    const companyRegion = region || "IN";

    // 1. Fuzzy Match checks
    if (!confirmOverride) {
      const fuzzy = await fuzzyMatchCompany(this.pool, name);
      if (fuzzy.level === "conflict") {
        return {
          status: 200,
          data: {
            conflict: "name_match",
            match: fuzzy.match
          }
        };
      } else if (fuzzy.level === "warning") {
        return {
          status: 200,
          data: {
            conflict: "possible_match",
            match: fuzzy.match,
            suggestion: `Did you mean "${fuzzy.match?.name}"?`
          }
        };
      }
    }

    let statusVal = "active";

    if (careersUrl && careersUrl.trim() !== "") {
      // URL format check
      try {
        const parsed = new URL(careersUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return {
            status: 400,
            data: { error: "invalid_url", message: "Only HTTP/HTTPS URLs are allowed." }
          };
        }
      } catch {
        return {
          status: 400,
          data: { error: "invalid_url", message: "Invalid URL format." }
        };
      }

      // Single listing URL check
      if (!confirmOverride && detectSingleListingUrl(careersUrl)) {
        return {
          status: 422,
          data: {
            error: "single_listing_url",
            message: "Looks like a single listing, not a careers page."
          }
        };
      }

      // Duplicate URL check
      if (!confirmOverride) {
        const dup = await checkDuplicateUrl(this.pool, careersUrl);
        if (dup.duplicate) {
          return {
            status: 200,
            data: {
              conflict: "duplicate_url",
              existingCompany: dup.existingCompany
            }
          };
        }
      }

      // URL page load and keyword scan check
      if (!confirmOverride) {
        const validation = await validateUrl(careersUrl);
        if (validation.warning === "not_careers_page") {
          return {
            status: 200,
            data: {
              warning: "not_careers_page",
              url: careersUrl,
              confirmToken: "confirm"
            }
          };
        }
      }
    } else {
      statusVal = "url_missing";
    }

    // Check region mismatch
    let regionWarning: string | null = null;
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

    const res = await this.pool.query(insertQuery, [
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

    return {
      status: 201,
      data: responseBody
    };
  }

  async updateCompany(id: string, body: { careersUrl?: string; status?: string; region?: string; confirmOverride?: boolean }) {
    // Fetch existing company
    const checkRes = await this.pool.query("SELECT * FROM companies WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return {
        status: 404,
        data: { error: "not_found" }
      };
    }
    const company = checkRes.rows[0];

    const { careersUrl, status, region, confirmOverride } = body;

    let finalUrl = careersUrl !== undefined ? careersUrl : company.careers_url;
    let oldUrl = company.careers_url;
    let newStatus = status || company.status;
    let newRegion = region || company.region;
    let sameDomainRedirect = false;
    let previousCareersUrl = company.previous_careers_url;

    // Handle URL change validation and redirect checks
    if (careersUrl !== undefined && careersUrl !== oldUrl) {
      if (careersUrl && careersUrl.trim() !== "") {
        // Format check
        try {
          const parsed = new URL(careersUrl);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return {
              status: 400,
              data: { error: "invalid_url", message: "Only HTTP/HTTPS URLs are allowed." }
            };
          }
        } catch {
          return {
            status: 400,
            data: { error: "invalid_url", message: "Invalid URL format." }
          };
        }

        // Single listing check
        if (!confirmOverride && detectSingleListingUrl(careersUrl)) {
          return {
            status: 422,
            data: {
              error: "single_listing_url",
              message: "Looks like a single listing, not a careers page."
            }
          };
        }

        // Duplicate URL check
        if (!confirmOverride) {
          const dup = await checkDuplicateUrl(this.pool, careersUrl, id);
          if (dup.duplicate) {
            return {
              status: 200,
              data: {
                conflict: "duplicate_url",
                existingCompany: dup.existingCompany
              }
            };
          }
        }

        // Redirect checks
        if (!confirmOverride) {
          try {
            const redirectRes = await detectRedirect(careersUrl);
            finalUrl = redirectRes.finalUrl;

            if (redirectRes.crossDomain) {
              if (redirectRes.isATS) {
                return {
                  status: 200,
                  data: {
                    warning: "ats_detected",
                    atsProvider: redirectRes.atsProvider,
                    suggestedUrl: finalUrl
                  }
                };
              } else {
                return {
                  status: 200,
                  data: {
                    warning: "cross_domain_redirect",
                    originalUrl: careersUrl,
                    finalUrl: finalUrl,
                    message: "Confirm this is the correct site"
                  }
                };
              }
            } else if (careersUrl !== finalUrl) {
              // Same domain redirect: auto-update
              sameDomainRedirect = true;
              previousCareersUrl = oldUrl;
            }
          } catch (err: any) {
            if (err.message === "redirect_loop") {
              return {
                status: 422,
                data: {
                  error: "redirect_loop",
                  message: "A redirect loop was detected at this URL."
                }
              };
            }
          }
        }

        // 3-step validation keyword check
        if (!confirmOverride) {
          const validation = await validateUrl(finalUrl);
          if (validation.warning === "not_careers_page") {
            return {
              status: 200,
              data: {
                warning: "not_careers_page",
                url: finalUrl,
                confirmToken: "confirm"
              }
            };
          }
        }

        newStatus = "active";
      } else {
        newStatus = "url_missing";
      }
    }

    // Determine region mismatch warning
    let regionWarning: string | null = null;
    if (careersUrl !== undefined && careersUrl !== oldUrl && careersUrl) {
      regionWarning = detectRegionMismatch(finalUrl, newRegion);
    }

    // Perform DB update
    const updateQuery = `
      UPDATE companies
      SET careers_url = $1,
          status = $2,
          region = $3,
          is_active = $4,
          previous_careers_url = $5,
          fail_count = CASE WHEN $1 <> $6 THEN 0 ELSE fail_count END,
          silent_fail_count = CASE WHEN $1 <> $6 THEN 0 ELSE silent_fail_count END,
          url_confirmed_by_user = CASE WHEN $1 <> $6 THEN true ELSE url_confirmed_by_user END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const res = await this.pool.query(updateQuery, [
      finalUrl || null,
      newStatus,
      newRegion,
      newStatus === "active",
      previousCareersUrl,
      oldUrl,
      id
    ]);

    const row = res.rows[0];
    const responseBody: any = {
      id: row.id,
      name: row.name,
      status: row.status,
      careersUrl: row.careers_url,
      fail_count: row.fail_count,
      url_confirmed_by_user: row.url_confirmed_by_user
    };

    if (sameDomainRedirect) {
      responseBody.redirected = true;
      responseBody.originalUrl = careersUrl;
      responseBody.finalUrl = finalUrl;
      responseBody.previous_careers_url = oldUrl;
    }

    if (regionWarning) {
      responseBody.warning = "region_mismatch";
      responseBody.message = regionWarning;
    }

    return {
      status: 200,
      data: responseBody
    };
  }

  async deleteCompany(id: string) {
    const checkRes = await this.pool.query("SELECT id FROM companies WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return {
        status: 404,
        data: { error: "not_found" }
      };
    }

    await this.pool.query(
      `UPDATE companies
       SET status = 'archived',
           is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    return {
      status: 200,
      data: {
        id,
        status: "archived",
        message: "Company archived successfully"
      }
    };
  }
}
