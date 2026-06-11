import type { Company, CompanyCategory } from "./types";

type SeedCompanyInput = {
  name: string;
  careersUrl: string;
  category: CompanyCategory;
  eligibleBranches: string[];
  minCgpa: number | null;
  avgPackageLpa: number | null;
};

const urlVerifiedAt = "2026-06-10T00:00:00.000Z";

const branches = {
  cs: ["Computer Science", "Information Technology"],
  csPlus: ["Computer Science", "Information Technology", "Electronics"],
  engineering: ["Computer Science", "Information Technology", "Electronics", "Electrical"],
  allEngineering: [
    "Computer Science",
    "Information Technology",
    "Electronics",
    "Electrical",
    "Mechanical",
    "Civil"
  ],
  core: ["Mechanical", "Electrical", "Electronics", "Civil"]
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createSeedCompany = (input: SeedCompanyInput): Company => ({
  id: slugify(input.name),
  slug: slugify(input.name),
  name: input.name,
  careersUrl: input.careersUrl,
  category: input.category,
  eligibleBranches: input.eligibleBranches,
  minCgpa: input.minCgpa,
  avgPackageLpa: input.avgPackageLpa,
  source: "seed",
  urlVerifiedAt,
  isActive: true
});

export const seedCompanies: Company[] = [
  createSeedCompany({
    name: "Google",
    careersUrl: "https://careers.google.com/jobs/results",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 8,
    avgPackageLpa: 32
  }),
  createSeedCompany({
    name: "Microsoft",
    careersUrl: "https://jobs.careers.microsoft.com/global/en/search",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 28
  }),
  createSeedCompany({
    name: "Amazon",
    careersUrl: "https://www.amazon.jobs/en",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 26
  }),
  createSeedCompany({
    name: "Atlassian",
    careersUrl: "https://www.atlassian.com/company/careers/all-jobs",
    category: "it-product",
    eligibleBranches: branches.cs,
    minCgpa: 8,
    avgPackageLpa: 24
  }),
  createSeedCompany({
    name: "Adobe",
    careersUrl: "https://careers.adobe.com/us/en",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 23
  }),
  createSeedCompany({
    name: "Salesforce",
    careersUrl: "https://careers.salesforce.com/en/jobs",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 22
  }),
  createSeedCompany({
    name: "Oracle",
    careersUrl: "https://www.oracle.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "SAP",
    careersUrl: "https://www.sap.com/about/careers.html",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "ServiceNow",
    careersUrl: "https://careers.servicenow.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 21
  }),
  createSeedCompany({
    name: "Workday",
    careersUrl: "https://workday.wd5.myworkdayjobs.com/Workday",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "Intuit",
    careersUrl: "https://jobs.intuit.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 22
  }),
  createSeedCompany({
    name: "Cisco",
    careersUrl: "https://jobs.cisco.com",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "IBM",
    careersUrl: "https://www.ibm.com/careers",
    category: "it-service",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 12
  }),
  createSeedCompany({
    name: "Accenture",
    careersUrl: "https://www.accenture.com/in-en/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.5
  }),
  createSeedCompany({
    name: "Infosys",
    careersUrl: "https://www.infosys.com/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 6.5
  }),
  createSeedCompany({
    name: "TCS",
    careersUrl: "https://www.tcs.com/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.2
  }),
  createSeedCompany({
    name: "Wipro",
    careersUrl: "https://careers.wipro.com",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.5
  }),
  createSeedCompany({
    name: "HCLTech",
    careersUrl: "https://www.hcltech.com/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.8
  }),
  createSeedCompany({
    name: "Cognizant",
    careersUrl: "https://careers.cognizant.com/in/en",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.5
  }),
  createSeedCompany({
    name: "Capgemini",
    careersUrl: "https://www.capgemini.com/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.5
  }),
  createSeedCompany({
    name: "Tech Mahindra",
    careersUrl: "https://careers.techmahindra.com",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.2
  }),
  createSeedCompany({
    name: "LTIMindtree",
    careersUrl: "https://www.ltimindtree.com/careers",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 4.8
  }),
  createSeedCompany({
    name: "Mphasis",
    careersUrl: "https://careers.mphasis.com",
    category: "it-service",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6,
    avgPackageLpa: 5
  }),
  createSeedCompany({
    name: "Persistent Systems",
    careersUrl: "https://www.persistent.com/careers",
    category: "it-service",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.5
  }),
  createSeedCompany({
    name: "Deloitte",
    careersUrl: "https://www2.deloitte.com/global/en/careers.html",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 8
  }),
  createSeedCompany({
    name: "EY",
    careersUrl: "https://www.ey.com/en_in/careers",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 7
  }),
  createSeedCompany({
    name: "PwC",
    careersUrl: "https://www.pwc.com/gx/en/careers.html",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.5
  }),
  createSeedCompany({
    name: "KPMG",
    careersUrl: "https://kpmg.com/in/en/home/careers.html",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.2
  }),
  createSeedCompany({
    name: "Bain & Company",
    careersUrl: "https://www.bain.com/careers",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 7.5,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Boston Consulting Group",
    careersUrl: "https://careers.bcg.com",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 7.5,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "McKinsey & Company",
    careersUrl: "https://www.mckinsey.com/careers",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 7.5,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "ZS Associates",
    careersUrl: "https://jobs.zs.com",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 10
  }),
  createSeedCompany({
    name: "Goldman Sachs",
    careersUrl: "https://www.goldmansachs.com/careers",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 22
  }),
  createSeedCompany({
    name: "JPMorgan Chase",
    careersUrl: "https://careers.jpmorgan.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "Morgan Stanley",
    careersUrl: "https://www.morganstanley.com/careers",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "American Express",
    careersUrl: "https://www.americanexpress.com/en-us/careers",
    category: "bfsi",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Visa",
    careersUrl: "https://corporate.visa.com/en/careers.html",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "Mastercard",
    careersUrl: "https://careers.mastercard.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "PayPal",
    careersUrl: "https://careers.pypl.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "Razorpay",
    careersUrl: "https://razorpay.com/jobs",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "PhonePe",
    careersUrl: "https://www.phonepe.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "Groww",
    careersUrl: "https://groww.in/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Zerodha",
    careersUrl: "https://zerodha.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Paytm",
    careersUrl: "https://paytm.com/careers",
    category: "startup",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 9
  }),
  createSeedCompany({
    name: "Flipkart",
    careersUrl: "https://www.flipkartcareers.com",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Meesho",
    careersUrl: "https://www.meesho.io/jobs",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "Swiggy",
    careersUrl: "https://careers.swiggy.com",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Zomato",
    careersUrl: "https://www.zomato.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Uber",
    careersUrl: "https://www.uber.com/us/en/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 26
  }),
  createSeedCompany({
    name: "Ola",
    careersUrl: "https://www.olacabs.com/careers",
    category: "startup",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 12
  }),
  createSeedCompany({
    name: "NVIDIA",
    careersUrl: "https://www.nvidia.com/en-in/about-nvidia/careers",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7.5,
    avgPackageLpa: 28
  }),
  createSeedCompany({
    name: "Intel",
    careersUrl: "https://jobs.intel.com",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "AMD",
    careersUrl: "https://careers.amd.com",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Qualcomm",
    careersUrl: "https://www.qualcomm.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Texas Instruments",
    careersUrl: "https://careers.ti.com",
    category: "core",
    eligibleBranches: ["Electronics", "Electrical", "Computer Science"],
    minCgpa: 7.5,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Samsung R&D",
    careersUrl: "https://research.samsung.com/careers",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Bosch",
    careersUrl: "https://www.bosch.in/careers",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 8
  }),
  createSeedCompany({
    name: "Siemens",
    careersUrl: "https://www.siemens.com/global/en/company/jobs.html",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 9
  }),
  createSeedCompany({
    name: "GE Aerospace",
    careersUrl: "https://jobs.gecareers.com",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 10
  }),
  createSeedCompany({
    name: "Honeywell",
    careersUrl: "https://careers.honeywell.com",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 11
  }),
  createSeedCompany({
    name: "Schneider Electric",
    careersUrl: "https://www.se.com/in/en/about-us/careers",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 8.5
  }),
  createSeedCompany({
    name: "Shell",
    careersUrl: "https://www.shell.com/careers",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 12
  }),
  createSeedCompany({
    name: "Reliance Industries",
    careersUrl: "https://www.ril.com/Careers.aspx",
    category: "core",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6.5,
    avgPackageLpa: 7
  }),
  createSeedCompany({
    name: "Tata Motors",
    careersUrl: "https://careers.tatamotors.com",
    category: "core",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6.5,
    avgPackageLpa: 7
  }),
  createSeedCompany({
    name: "Mahindra & Mahindra",
    careersUrl: "https://www.mahindra.com/careers",
    category: "core",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6.5,
    avgPackageLpa: 7
  }),
  createSeedCompany({
    name: "Bajaj Auto",
    careersUrl: "https://www.bajajauto.com/careers",
    category: "core",
    eligibleBranches: branches.core,
    minCgpa: 6.5,
    avgPackageLpa: 7
  }),
  createSeedCompany({
    name: "Maruti Suzuki",
    careersUrl: "https://www.marutisuzuki.com/corporate/careers",
    category: "core",
    eligibleBranches: branches.core,
    minCgpa: 6.5,
    avgPackageLpa: 6.8
  }),
  createSeedCompany({
    name: "Larsen & Toubro",
    careersUrl: "https://www.larsentoubro.com/corporate/careers",
    category: "core",
    eligibleBranches: branches.allEngineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.5
  }),
  createSeedCompany({
    name: "Mercedes-Benz Research",
    careersUrl: "https://jobs.mercedes-benz.com",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 13
  }),
  createSeedCompany({
    name: "Renault Nissan Technology",
    careersUrl: "https://rntbcijobs.com",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 8.5
  }),
  createSeedCompany({
    name: "HSBC",
    careersUrl: "https://www.hsbc.com/careers",
    category: "bfsi",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 10
  }),
  createSeedCompany({
    name: "Barclays",
    careersUrl: "https://search.jobs.barclays",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Deutsche Bank",
    careersUrl: "https://careers.db.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Standard Chartered",
    careersUrl: "https://www.sc.com/en/global-careers",
    category: "bfsi",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 9
  }),
  createSeedCompany({
    name: "Citi",
    careersUrl: "https://jobs.citi.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 13
  }),
  createSeedCompany({
    name: "Wells Fargo",
    careersUrl: "https://www.wellsfargojobs.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 12
  }),
  createSeedCompany({
    name: "UBS",
    careersUrl: "https://www.ubs.com/global/en/careers.html",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Media.net",
    careersUrl: "https://careers.media.net",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "Freshworks",
    careersUrl: "https://www.freshworks.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Zoho",
    careersUrl: "https://www.zoho.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 6.5,
    avgPackageLpa: 10
  }),
  createSeedCompany({
    name: "Postman",
    careersUrl: "https://www.postman.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "BrowserStack",
    careersUrl: "https://www.browserstack.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Chargebee",
    careersUrl: "https://www.chargebee.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Gojek",
    careersUrl: "https://www.gojek.io/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "CRED",
    careersUrl: "https://careers.cred.club",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "InMobi",
    careersUrl: "https://www.inmobi.com/company/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "ShareChat",
    careersUrl: "https://sharechat.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Myntra",
    careersUrl: "https://www.myntra.com/careers",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 14
  }),
  createSeedCompany({
    name: "Walmart Global Tech",
    careersUrl: "https://tech.walmart.com/content/walmart-global-tech/en_us/careers.html",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Target",
    careersUrl: "https://corporate.target.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Booking.com",
    careersUrl: "https://jobs.booking.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 24
  }),
  createSeedCompany({
    name: "Expedia Group",
    careersUrl: "https://careers.expediagroup.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 21
  }),
  createSeedCompany({
    name: "Agoda",
    careersUrl: "https://careersatagoda.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "Red Hat",
    careersUrl: "https://www.redhat.com/en/jobs",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "VMware",
    careersUrl: "https://careers.vmware.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "Dell Technologies",
    careersUrl: "https://jobs.dell.com",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 11
  }),
  createSeedCompany({
    name: "HP Enterprise",
    careersUrl: "https://careers.hpe.com",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 11
  }),
  createSeedCompany({
    name: "NetApp",
    careersUrl: "https://careers.netapp.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "Arm",
    careersUrl: "https://careers.arm.com",
    category: "core",
    eligibleBranches: ["Electronics", "Electrical", "Computer Science"],
    minCgpa: 7.5,
    avgPackageLpa: 20
  }),
  createSeedCompany({
    name: "Broadcom",
    careersUrl: "https://careers.broadcom.com",
    category: "core",
    eligibleBranches: ["Electronics", "Electrical", "Computer Science"],
    minCgpa: 7.5,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "Micron",
    careersUrl: "https://careers.micron.com",
    category: "core",
    eligibleBranches: ["Electronics", "Electrical", "Computer Science"],
    minCgpa: 7,
    avgPackageLpa: 15
  }),
  createSeedCompany({
    name: "Analog Devices",
    careersUrl: "https://www.analog.com/en/careers.html",
    category: "core",
    eligibleBranches: ["Electronics", "Electrical", "Computer Science"],
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Cadence",
    careersUrl: "https://www.cadence.com/en_US/home/company/careers.html",
    category: "it-product",
    eligibleBranches: ["Electronics", "Computer Science", "Information Technology"],
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Synopsys",
    careersUrl: "https://www.synopsys.com/careers.html",
    category: "it-product",
    eligibleBranches: ["Electronics", "Computer Science", "Information Technology"],
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "MathWorks",
    careersUrl: "https://www.mathworks.com/company/jobs.html",
    category: "it-product",
    eligibleBranches: branches.engineering,
    minCgpa: 7.5,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "EPAM",
    careersUrl: "https://www.epam.com/careers",
    category: "it-service",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 7.5
  }),
  createSeedCompany({
    name: "Publicis Sapient",
    careersUrl: "https://careers.publicissapient.com",
    category: "consulting",
    eligibleBranches: branches.engineering,
    minCgpa: 6.5,
    avgPackageLpa: 8
  }),
  createSeedCompany({
    name: "Thoughtworks",
    careersUrl: "https://www.thoughtworks.com/careers",
    category: "consulting",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 10
  }),
  createSeedCompany({
    name: "S&P Global",
    careersUrl: "https://careers.spglobal.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 6.5,
    avgPackageLpa: 9
  }),
  createSeedCompany({
    name: "BlackRock",
    careersUrl: "https://careers.blackrock.com",
    category: "bfsi",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 16
  }),
  createSeedCompany({
    name: "Sprinklr",
    careersUrl: "https://www.sprinklr.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 17
  }),
  createSeedCompany({
    name: "Cohesity",
    careersUrl: "https://www.cohesity.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 18
  }),
  createSeedCompany({
    name: "Rubrik",
    careersUrl: "https://www.rubrik.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7,
    avgPackageLpa: 19
  }),
  createSeedCompany({
    name: "Snowflake",
    careersUrl: "https://careers.snowflake.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 24
  }),
  createSeedCompany({
    name: "Databricks",
    careersUrl: "https://www.databricks.com/company/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 24
  }),
  createSeedCompany({
    name: "Cloudflare",
    careersUrl: "https://www.cloudflare.com/careers",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 22
  }),
  createSeedCompany({
    name: "Stripe",
    careersUrl: "https://stripe.com/jobs",
    category: "startup",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 24
  }),
  createSeedCompany({
    name: "LinkedIn",
    careersUrl: "https://careers.linkedin.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 7.5,
    avgPackageLpa: 26
  }),
  createSeedCompany({
    name: "Meta",
    careersUrl: "https://www.metacareers.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 8,
    avgPackageLpa: 32
  }),
  createSeedCompany({
    name: "Apple",
    careersUrl: "https://jobs.apple.com",
    category: "it-product",
    eligibleBranches: branches.csPlus,
    minCgpa: 8,
    avgPackageLpa: 30
  }),
  createSeedCompany({
    name: "Tesla",
    careersUrl: "https://www.tesla.com/careers",
    category: "core",
    eligibleBranches: branches.engineering,
    minCgpa: 7,
    avgPackageLpa: 18
  })
].slice(0, 100);
