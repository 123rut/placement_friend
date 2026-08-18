export class LogicalJobKey {
  static generate(
    companyId: string,
    title: string,
    location?: string | null,
    category?: string | null,
  ): string {
    const cleanCompany = (companyId || "").trim().toLowerCase();
    
    // Conservative normalization: lowercase, collapse whitespace, keep distinctive hyphens/slashes
    const cleanTitle = (title || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const cleanLocation = (location || "global")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const cleanCategory = (category || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

    const parts = [cleanCompany, cleanTitle, cleanLocation];
    if (cleanCategory) {
      parts.push(cleanCategory);
    }

    return parts.join("|");
  }
}
