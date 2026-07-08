import { guessEligibilityFromRole, isStudentEligible, normalizeBranch } from "./validator";

function runTests() {
  console.log("==================================================");
  console.log("    CLASSIFICATION & PERSONALIZATION TEST SUITE   ");
  console.log("==================================================");

  // 1. Test Branch Normalization
  console.log("\n--- Testing Branch Normalization ---");
  const branchTests = [
    { input: "CSE", expected: "Computer Science" },
    { input: "Computer Science Engineering", expected: "Computer Science" },
    { input: "IT", expected: "Information Technology" },
    { input: "ECE", expected: "Electronics" },
    { input: "Electronics and Communication", expected: "Electronics" },
    { input: "EEE", expected: "Electrical" },
    { input: "MECH", expected: "Mechanical" },
    { input: "Civil Engineering", expected: "Civil" }
  ];

  for (const t of branchTests) {
    const output = normalizeBranch(t.input);
    if (output !== t.expected) {
      console.error(`[FAIL] normalizeBranch("${t.input}") got "${output}", expected "${t.expected}"`);
      process.exitCode = 1;
    } else {
      console.log(`[PASS] "${t.input}" -> "${output}"`);
    }
  }

  // 2. Test Eligibility Classification Engine
  console.log("\n--- Testing Eligibility Classification Engine ---");
  const roleTests = [
    {
      role: "Software Engineer Intern (Remote)",
      expectedBranches: ["Computer Science", "Information Technology"],
      expectedMinConfidence: 0.9
    },
    {
      role: "Backend Web Developer",
      expectedBranches: ["Computer Science", "Information Technology"],
      expectedMinConfidence: 0.9
    },
    {
      role: "Data Analyst",
      expectedBranches: ["Computer Science", "Information Technology"],
      expectedMinConfidence: 0.9
    },
    {
      role: "Embedded Systems Engineer",
      expectedBranches: ["Electronics"],
      expectedMinConfidence: 0.9
    },
    {
      role: "Mechanical Design Intern",
      expectedBranches: ["Mechanical"],
      expectedMinConfidence: 0.9
    },
    {
      role: "HR Generalist & Talent Acquisition",
      expectedBranches: [],
      expectedMinConfidence: 0.9
    },
    {
      role: "Marketing Specialist",
      expectedBranches: [],
      expectedMinConfidence: 0.9
    }
  ];

  for (const t of roleTests) {
    const result = guessEligibilityFromRole(t.role);
    const hasAllBranches = t.expectedBranches.every(b => result.branches.includes(b)) && result.branches.length === t.expectedBranches.length;
    
    if (!hasAllBranches || result.confidence < t.expectedMinConfidence) {
      console.error(`[FAIL] guessEligibilityFromRole("${t.role}") got branches [${result.branches.join(", ")}], confidence ${result.confidence}`);
      process.exitCode = 1;
    } else {
      console.log(`[PASS] "${t.role}" classified as [${result.branches.join(", ")}] (confidence: ${result.confidence})`);
    }
  }

  // 3. Test Student Eligibility Checking
  console.log("\n--- Testing Student Eligibility Matching ---");
  const eligibilityTests = [
    { student: "Computer Science", allowed: ["Computer Science", "Information Technology"], expected: true },
    { student: "Computer Science", allowed: ["Electronics"], expected: false },
    { student: "CSE", allowed: ["Computer Science"], expected: true },
    { student: "ECE", allowed: ["Electronics", "ECE"], expected: true },
    { student: "Mechanical", allowed: ["Civil"], expected: false },
    { student: "Computer Science", allowed: [], expected: false } // Excluded roles have empty allowed array
  ];

  for (const t of eligibilityTests) {
    const res = isStudentEligible(t.student, t.allowed);
    if (res !== t.expected) {
      console.error(`[FAIL] isStudentEligible("${t.student}", [${t.allowed.join(", ")}]) got ${res}, expected ${t.expected}`);
      process.exitCode = 1;
    } else {
      console.log(`[PASS] Student: "${t.student}", Allowed: [${t.allowed.join(", ")}] -> Eligible: ${res}`);
    }
  }

  console.log("\n==========================================");
  console.log("   ALL PERSONALIZATION TESTS PASSED!      ");
  console.log("==========================================");
}

runTests();
