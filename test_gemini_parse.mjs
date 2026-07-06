import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RESUME_JSON_SCHEMA = {
  type: "object",
  properties: {
    personal: {
      type: "object",
      properties: {
        name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
        location: { type: "string" }, linkedin: { type: "string" }, github: { type: "string" },
        portfolio: { type: "string" }, website: { type: "string" },
      },
      required: ["name", "email", "phone", "location", "linkedin", "github", "portfolio", "website"],
      additionalProperties: false,
    },
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" }, role: { type: "string" }, normalizedRole: { type: "string" },
          years: { type: "number" }, startDate: { type: "string" }, endDate: { type: "string" },
          current: { type: "boolean" }, durationMonths: { type: "number" }, description: { type: "string" },
        },
        required: ["company", "role", "normalizedRole", "years", "startDate", "endDate", "current", "durationMonths", "description"],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" }, normalizedDegree: { type: "string" },
          branch: { type: "string" }, college: { type: "string" }, year: { type: "number" },
        },
        required: ["degree", "normalizedDegree", "branch", "college", "year"],
        additionalProperties: false,
      },
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, issuer: { type: "string" }, year: { type: "number" } },
        required: ["name", "issuer", "year"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" }, tech: { type: "array", items: { type: "string" } },
          description: { type: "string" }, role: { type: "string" }, duration: { type: "string" },
        },
        required: ["name", "tech", "description", "role", "duration"],
        additionalProperties: false,
      },
    },
    achievements: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" } },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
    publications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, venue: { type: "string" }, year: { type: "number" }, url: { type: "string" },
        },
        required: ["title", "venue", "year", "url"],
        additionalProperties: false,
      },
    },
    languages: { type: "array", items: { type: "string" } },
    preferredRoles: { type: "array", items: { type: "string" } },
    preferredIndustries: { type: "array", items: { type: "string" } },
    workAuthorization: { type: "string" },
    totalExperienceYears: { type: "number" },
    currentRole: { type: "string" },
    currentCompany: { type: "string" },
    careerStage: {
      type: "string",
      enum: ["Student", "Intern", "New Graduate", "Entry Level", "Mid Level", "Senior", "Lead", "Manager", "Executive", "Career Switcher"],
    },
  },
  required: [
    "personal", "summary", "skills", "experience", "education", "certifications",
    "projects", "achievements", "publications", "languages", "preferredRoles",
    "preferredIndustries", "workAuthorization", "totalExperienceYears",
    "currentRole", "currentCompany", "careerStage",
  ],
  additionalProperties: false,
};

const resumeText = `
2020 - Present
Backend Engineer
- Developed and deployed multiple microservices using Node.js and AWS
- Collaborated with cross-functional teams to design and implement scalable solutions
- Improved system efficiency by 30%
- Implemented automated testing and deployment scripts
- Participated in system design discussions
`;

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  const prompt = `Extract structured data from this resume text for a general-purpose career platform. Do not assume the candidate is a student. Read the entire resume text and identify all technical skills, programming languages, databases, frameworks, libraries, cloud providers, tools, certifications, achievements, publications, roles, and industries mentioned anywhere in the text. Return a JSON object conforming to this JSON Schema:
${JSON.stringify(RESUME_JSON_SCHEMA, null, 2)}

Resume Text:
${resumeText}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
      signal: AbortSignal.timeout(15000)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    if (res.ok) {
      console.log("SUCCESS:", JSON.stringify(data, null, 2));
    } else {
      console.log("ERROR:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

testGemini();
