import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'd:/projects/agent_scrapper/.env.local' });

async function run() {
  console.log("Connecting to DATABASE_URL:", process.env.DATABASE_URL);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const userId = '8eacbdf4-62b4-4d8e-8906-286e3e1faee7';
  const rawText = "Test Resume Text";
  const profile = {
    personal: { name: "Test User", email: "test@example.com", phone: "1234567890", location: "Pune", linkedin: "", github: "", portfolio: "", website: "" },
    summary: "Test summary",
    skills: ["Node.js", "AWS"],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    achievements: [],
    publications: [],
    languages: ["English"],
    preferredRoles: ["Software Engineer"],
    preferredIndustries: ["Tech"],
    workAuthorization: "Authorized",
    totalExperienceYears: 2,
    currentRole: "Engineer",
    currentCompany: "Acme",
    careerStage: "Entry Level"
  };

  const embeddingParam = null;

  try {
    const existing = await pool.query(
      `SELECT id FROM candidate_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [userId]
    );
    console.log("Existing profile count:", existing.rows.length);

    if (existing.rows[0]) {
      console.log("Updating profile...");
      const updateResult = await pool.query(
        `UPDATE candidate_profiles
         SET resume_raw_text = $2,
             skills = $3,
             experience = $4,
             education = $5,
             projects = $6,
             personal = $7,
             summary = $8,
             certifications = $9,
             achievements = $10,
             publications = $11,
             languages = $12,
             preferred_roles = $13,
             preferred_industries = $14,
             work_authorization = $15,
             total_experience_years = $16,
             "current_role" = $17,
             current_company = $18,
             career_stage = $19,
             embedding = COALESCE($20::vector, embedding),
             updated_at = NOW()
         WHERE user_id = $1::uuid
         RETURNING id`,
        [
          userId,
          rawText,
          profile.skills,
          JSON.stringify(profile.experience),
          JSON.stringify(profile.education),
          JSON.stringify(profile.projects),
          JSON.stringify(profile.personal),
          profile.summary,
          JSON.stringify(profile.certifications),
          JSON.stringify(profile.achievements),
          JSON.stringify(profile.publications),
          profile.languages,
          profile.preferredRoles,
          profile.preferredIndustries,
          profile.workAuthorization,
          profile.totalExperienceYears,
          profile.currentRole,
          profile.currentCompany,
          profile.careerStage,
          embeddingParam,
        ]
      );
      console.log("Update Success. ID:", updateResult.rows[0].id);
    } else {
      console.log("Inserting profile...");
      const insertResult = await pool.query(
        `INSERT INTO candidate_profiles (
            user_id,
            resume_raw_text,
            skills,
            experience,
            education,
            projects,
            personal,
            summary,
            certifications,
            achievements,
            publications,
            languages,
            preferred_roles,
            preferred_industries,
            work_authorization,
            total_experience_years,
            "current_role",
            current_company,
            career_stage,
            embedding
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, $20::vector)
        RETURNING id`,
        [
          userId,
          rawText,
          profile.skills,
          JSON.stringify(profile.experience),
          JSON.stringify(profile.education),
          JSON.stringify(profile.projects),
          JSON.stringify(profile.personal),
          profile.summary,
          JSON.stringify(profile.certifications),
          JSON.stringify(profile.achievements),
          JSON.stringify(profile.publications),
          profile.languages,
          profile.preferredRoles,
          profile.preferredIndustries,
          profile.workAuthorization,
          profile.totalExperienceYears,
          profile.currentRole,
          profile.currentCompany,
          profile.careerStage,
          embeddingParam,
        ]
      );
      console.log("Insert Success. ID:", insertResult.rows[0].id);
    }
  } catch (err) {
    console.error("DB Operation failed:", err);
  } finally {
    await pool.end();
  }
}

run();
