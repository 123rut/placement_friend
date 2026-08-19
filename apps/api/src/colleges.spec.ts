import {
  colleges,
  getCollegeByEmail,
  isCollegeEmail,
  findCollegeById,
  searchColleges,
} from "@piaa/domain";

describe("Domain Package - Colleges Catalog & Verification Helpers", () => {
  describe("getCollegeByEmail & isCollegeEmail", () => {
    it("detects recognized college domain correctly", () => {
      const college = getCollegeByEmail("student@iitb.ac.in");
      expect(college).not.toBeNull();
      expect(college?.id).toBe("iit-bombay");
      expect(college?.name).toBe("Indian Institute of Technology Bombay");
      expect(isCollegeEmail("student@iitb.ac.in")).toBe(true);
    });

    it("handles uppercase email domains and leading/trailing whitespace", () => {
      const college = getCollegeByEmail("  STUDENT@NITT.EDU  ");
      expect(college).not.toBeNull();
      expect(college?.id).toBe("nit-trichy");
      expect(isCollegeEmail("  STUDENT@NITT.EDU  ")).toBe(true);
    });

    it("never treats Gmail, Outlook, Yahoo or personal domains as college domains", () => {
      expect(getCollegeByEmail("student@gmail.com")).toBeNull();
      expect(isCollegeEmail("student@gmail.com")).toBe(false);

      expect(getCollegeByEmail("student@outlook.com")).toBeNull();
      expect(isCollegeEmail("student@outlook.com")).toBe(false);

      expect(getCollegeByEmail("student@yahoo.com")).toBeNull();
      expect(isCollegeEmail("student@yahoo.com")).toBe(false);

      expect(getCollegeByEmail("student@icloud.com")).toBeNull();
      expect(isCollegeEmail("student@icloud.com")).toBe(false);

      expect(getCollegeByEmail("student@protonmail.com")).toBeNull();
      expect(isCollegeEmail("student@protonmail.com")).toBe(false);
    });

    it("returns null for unlisted or non-catalog domains without error", () => {
      expect(getCollegeByEmail("student@harvard.edu")).toBeNull();
      expect(isCollegeEmail("student@harvard.edu")).toBe(false);

      expect(getCollegeByEmail("engineer@company.org")).toBeNull();
      expect(isCollegeEmail("engineer@company.org")).toBe(false);
    });

    it("safely handles malformed, empty, or missing email inputs", () => {
      expect(getCollegeByEmail("")).toBeNull();
      expect(isCollegeEmail("")).toBe(false);

      expect(getCollegeByEmail("invalid-email-string")).toBeNull();
      expect(isCollegeEmail("invalid-email-string")).toBe(false);

      expect(getCollegeByEmail("@nodomain")).toBeNull();
      expect(getCollegeByEmail("notld@")).toBeNull();

      expect(getCollegeByEmail(null as any)).toBeNull();
      expect(isCollegeEmail(null as any)).toBe(false);

      expect(getCollegeByEmail(undefined as any)).toBeNull();
      expect(isCollegeEmail(undefined as any)).toBe(false);
    });
  });

  describe("findCollegeById", () => {
    it("finds college by ID case-insensitively", () => {
      const college = findCollegeById("iit-bombay");
      expect(college).not.toBeNull();
      expect(college?.name).toBe("Indian Institute of Technology Bombay");

      const collegeUpper = findCollegeById("IIT-DELHI");
      expect(collegeUpper).not.toBeNull();
      expect(collegeUpper?.name).toBe("Indian Institute of Technology Delhi");
    });

    it("returns null for non-existent IDs and invalid inputs", () => {
      expect(findCollegeById("unknown-id")).toBeNull();
      expect(findCollegeById("")).toBeNull();
      expect(findCollegeById(null as any)).toBeNull();
      expect(findCollegeById(undefined as any)).toBeNull();
    });
  });

  describe("searchColleges", () => {
    it("matches colleges by name, city, state, or ID", () => {
      const byName = searchColleges("Technology Bombay");
      expect(byName.length).toBeGreaterThanOrEqual(1);
      expect(byName.some((c) => c.id === "iit-bombay")).toBe(true);

      const byCity = searchColleges("Nanded");
      expect(byCity.length).toBeGreaterThanOrEqual(1);
      expect(byCity.some((c) => c.id === "sggs-nanded")).toBe(true);

      const byState = searchColleges("Maharashtra");
      expect(byState.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty array for empty query, whitespace, or invalid inputs", () => {
      expect(searchColleges("")).toEqual([]);
      expect(searchColleges("   ")).toEqual([]);
      expect(searchColleges(null as any)).toEqual([]);
      expect(searchColleges(undefined as any)).toEqual([]);
    });

    it("respects the limit parameter", () => {
      const results = searchColleges("Maharashtra", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("returns empty array when no colleges match", () => {
      expect(searchColleges("xyz-non-existent-institution-query-12345")).toEqual([]);
    });
  });
});
