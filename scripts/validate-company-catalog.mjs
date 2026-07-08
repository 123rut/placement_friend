import { seedCompanies } from "../packages/domain/src/companies.ts";

const timeoutMs = 15_000;
const concurrency = 8;

function workdayHostFor(company) {
  if (company.host) {
    return company.host;
  }

  try {
    const host = new URL(company.careersUrl).host;
    if (host.includes("myworkdayjobs.com")) {
      return host;
    }
  } catch {
    // Fall through to the common Workday host pattern.
  }

  return `${company.identifier}.wd1.myworkdayjobs.com`;
}

function validateMetadata(company) {
  const required = ["id", "name", "ats", "identifier", "careersUrl", "city", "country", "industry"];
  const missing = required.filter((key) => !company[key]);
  if (company.ats === "workday" && !company.site) {
    missing.push("site");
  }

  return {
    company,
    ok: missing.length === 0,
    status: missing.length === 0 ? "metadata ok" : `missing ${missing.join(", ")}`,
    durationMs: 0,
    error: missing.length === 0 ? null : `Missing fields: ${missing.join(", ")}`,
  };
}

function validateCatalogShape(companies) {
  const seenIds = new Set();
  const duplicateIds = new Set();

  for (const company of companies) {
    if (seenIds.has(company.id)) {
      duplicateIds.add(company.id);
    }
    seenIds.add(company.id);
  }

  return [...duplicateIds].map((id) => ({
    company: {
      id,
      ats: "catalog",
    },
    ok: false,
    status: "duplicate id",
    durationMs: 0,
    error: `Duplicate company id: ${id}`,
  }));
}

function requestFor(company) {
  switch (company.ats) {
    case "greenhouse":
      return {
        url: `https://boards-api.greenhouse.io/v1/boards/${company.identifier}/jobs`,
      };
    case "lever":
      return {
        url: `https://api.lever.co/v0/postings/${company.identifier}?mode=json`,
      };
    case "ashby":
      return {
        url: `https://api.ashbyhq.com/posting-api/job-board/${company.identifier}?includeCompensation=false`,
      };
    case "workday":
      if (!company.site) {
        throw new Error("Workday requires host and site metadata");
      }
      const host = workdayHostFor(company);
      return {
        url: `https://${host}/wday/cxs/${company.identifier}/${company.site}/jobs`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appliedFacets: {},
            limit: 1,
            offset: 0,
            searchText: "",
          }),
        },
      };
    case "smartrecruiters":
      return {
        url: `https://api.smartrecruiters.com/v1/companies/${company.identifier}/postings?limit=1`,
      };
    case "amazon":
      return {
        url: "https://www.amazon.jobs/en/search.json?base_query=&result_limit=1&offset=0",
      };
    default:
      throw new Error(`Unsupported ATS: ${company.ats}`);
  }
}

async function validate(company) {
  const startedAt = Date.now();

  try {
    const { url, init = {} } = requestFor(company);
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "CareerPilot-Catalog-Validator/1.0",
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      company,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: response.ok ? null : response.statusText,
    };
  } catch (error) {
    return {
      company,
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapWithConcurrency(items, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const args = process.argv.slice(2);
const metadataOnly = args.includes("--metadata-only");
const requestedIds = new Set(args.filter((arg) => arg !== "--metadata-only"));
const companies = requestedIds.size
  ? seedCompanies.filter((company) => requestedIds.has(company.id))
  : seedCompanies.filter((company) => company.isActive !== false);


if (requestedIds.size) {
  const foundIds = new Set(companies.map((company) => company.id));
  const missingIds = [...requestedIds].filter((id) => !foundIds.has(id));
  if (missingIds.length) {
    console.error(`Unknown company IDs: ${missingIds.join(", ")}`);
    process.exit(1);
  }
}

const mode = metadataOnly ? "metadata" : "live ATS";
console.log(`Validating ${companies.length} ATS configurations (${mode})...`);
const results = metadataOnly
  ? companies.map(validateMetadata)
  : await mapWithConcurrency(companies, validate);
const catalogShapeResults = validateCatalogShape(companies);
const allResults = [...catalogShapeResults, ...results];
const failed = allResults.filter((result) => !result.ok);

for (const result of allResults) {
  const marker = result.ok ? "PASS" : "FAIL";
  const status = result.status || result.error;
  console.log(
    `${marker.padEnd(4)} ${result.company.id.padEnd(28)} ${result.company.ats.padEnd(15)} ${String(status).padEnd(20)} ${result.durationMs}ms`,
  );
}

const passed = allResults.length - failed.length;
console.log(`\n${passed}/${allResults.length} ATS configurations passed.`);
if (failed.length) {
  process.exitCode = 1;
}
