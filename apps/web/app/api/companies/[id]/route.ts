import { NextResponse } from "next/server";
import { pool } from "../../../../../worker/src/db";
import {
  validateUrl,
  checkDuplicateUrl,
  detectSingleListingUrl,
  detectRegionMismatch
} from "../../../../../worker/src/validator";
import { detectRedirect } from "../../../../../worker/src/scraper";

/**
 * PATCH /api/companies/:id
 * Update URL, status, or region for a company.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Fetch existing company
    const checkRes = await pool.query("SELECT * FROM companies WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const company = checkRes.rows[0];

    const body = await request.json();
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
            return NextResponse.json({ error: "invalid_url", message: "Only HTTP/HTTPS URLs are allowed." }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ error: "invalid_url", message: "Invalid URL format." }, { status: 400 });
        }

        // Single listing check
        if (!confirmOverride && detectSingleListingUrl(careersUrl)) {
          return NextResponse.json({
            error: "single_listing_url",
            message: "Looks like a single listing, not a careers page."
          }, { status: 422 });
        }

        // Duplicate URL check
        if (!confirmOverride) {
          const dup = await checkDuplicateUrl(careersUrl, id);
          if (dup.duplicate) {
            return NextResponse.json({
              conflict: "duplicate_url",
              existingCompany: dup.existingCompany
            });
          }
        }

        // Redirect checks
        if (!confirmOverride) {
          try {
            const redirectRes = await detectRedirect(careersUrl);
            finalUrl = redirectRes.finalUrl;

            if (redirectRes.crossDomain) {
              if (redirectRes.isATS) {
                return NextResponse.json({
                  warning: "ats_detected",
                  atsProvider: redirectRes.atsProvider,
                  suggestedUrl: finalUrl
                });
              } else {
                return NextResponse.json({
                  warning: "cross_domain_redirect",
                  originalUrl: careersUrl,
                  finalUrl: finalUrl,
                  message: "Confirm this is the correct site"
                });
              }
            } else if (careersUrl !== finalUrl) {
              // Same domain redirect: auto-update
              sameDomainRedirect = true;
              previousCareersUrl = oldUrl;
            }
          } catch (err: any) {
            if (err.message === "redirect_loop") {
              return NextResponse.json({
                error: "redirect_loop",
                message: "A redirect loop was detected at this URL."
              }, { status: 422 });
            }
          }
        }

        // 3-step validation keyword check
        if (!confirmOverride) {
          const validation = await validateUrl(finalUrl);
          if (validation.warning === "not_careers_page") {
            return NextResponse.json({
              warning: "not_careers_page",
              url: finalUrl,
              confirmToken: "confirm"
            });
          }
        }

        newStatus = "active";
      } else {
        newStatus = "url_missing";
      }
    }

    // Determine region mismatch warning
    let regionWarning = null;
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

    const res = await pool.query(updateQuery, [
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

    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error("PATCH company error:", error);
    return NextResponse.json({ error: "server_error", message: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/companies/:id
 * Soft-delete by setting status = 'archived' and is_active = false.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const checkRes = await pool.query("SELECT id FROM companies WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await pool.query(
      `UPDATE companies
       SET status = 'archived',
           is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({
      id,
      status: "archived",
      message: "Company archived successfully"
    });
  } catch (error: any) {
    console.error("DELETE company error:", error);
    return NextResponse.json({ error: "server_error", message: error.message }, { status: 500 });
  }
}
