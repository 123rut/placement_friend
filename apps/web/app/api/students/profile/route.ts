import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "../../../../lib/supabase/server";
import { getCollegeByEmailDb, getCollegeByIdDb } from "../../../../lib/supabase/colleges";

export async function POST(request: NextRequest) {
  return handleProfileUpdate(request);
}

export async function PUT(request: NextRequest) {
  return handleProfileUpdate(request);
}

async function handleProfileUpdate(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createAdminClient();

    const body = await request.json().catch(() => ({}));
    const {
      fullName,
      branch,
      cgpa,
      batchYear,
      collegeId,
      customInstitutionName,
      institutionSource
    } = body;

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const parsedCgpa = parseFloat(cgpa);
    if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
      return NextResponse.json({ error: "Please enter a valid CGPA between 0.0 and 10.0." }, { status: 400 });
    }

    const parsedBatchYear = parseInt(batchYear);
    if (isNaN(parsedBatchYear) || parsedBatchYear < 2000 || parsedBatchYear > 2100) {
      return NextResponse.json({ error: "Please enter a valid graduation batch year." }, { status: 400 });
    }

    // 1. Check if the user's authenticated email matches any recognized college domain
    const detectedCollege = await getCollegeByEmailDb(adminDb, user.email || "").catch(() => null);

    let finalCollegeId: string | null = null;
    let finalCustomName: string | null = null;
    let finalSource: "AUTO_DOMAIN" | "USER_SELECTED" | "CUSTOM" = "USER_SELECTED";
    let finalVerified = false;

    // 2. Validate and enforce institution selection & verification rules
    if (institutionSource === "CUSTOM" || (!collegeId && customInstitutionName?.trim())) {
      const trimmedCustom = (customInstitutionName || "").trim();
      if (!trimmedCustom) {
        return NextResponse.json({ error: "Custom institution name cannot be empty." }, { status: 400 });
      }
      finalCollegeId = null;
      finalCustomName = trimmedCustom;
      finalSource = "CUSTOM";
      finalVerified = false;
    } else if (collegeId && typeof collegeId === "string" && collegeId.trim()) {
      const validCollege = await getCollegeByIdDb(adminDb, collegeId.trim()).catch(() => null);
      if (!validCollege) {
        return NextResponse.json({ error: "Selected college is not in the recognized registry." }, { status: 400 });
      }

      finalCollegeId = validCollege.id;
      finalCustomName = null;

      // Backend verifies whether the email domain actually matches this college
      const isEmailDomainMatch = detectedCollege !== null && detectedCollege.id === validCollege.id;

      if (institutionSource === "AUTO_DOMAIN" && isEmailDomainMatch) {
        finalSource = "AUTO_DOMAIN";
        finalVerified = true;
      } else if (isEmailDomainMatch) {
        finalSource = "AUTO_DOMAIN";
        finalVerified = true;
      } else {
        finalSource = "USER_SELECTED";
        finalVerified = false;
      }
    } else if (detectedCollege) {
      // Fallback to auto-detected college if no explicit selection was provided
      finalCollegeId = detectedCollege.id;
      finalCustomName = null;
      finalSource = "AUTO_DOMAIN";
      finalVerified = true;
    } else {
      finalCollegeId = null;
      finalCustomName = null;
      finalSource = "USER_SELECTED";
      finalVerified = false;
    }

    // 3. Persist student profile safely using admin client with auth client fallback
    const hasServiceKey = Boolean(process.env.NEXT_PRIVATE_SUPABASE_SERVICE_KEY);
    const dbClient = hasServiceKey ? adminDb : supabase;

    // Check if record exists
    let existingStudent: any = null;
    try {
      const { data } = await dbClient
        .from("students")
        .select("id, college_email")
        .or(`id.eq.${user.id},college_email.eq.${user.email}`)
        .maybeSingle();
      existingStudent = data;
    } catch {
      const { data } = await supabase
        .from("students")
        .select("id, college_email")
        .or(`id.eq.${user.id},college_email.eq.${user.email}`)
        .maybeSingle();
      existingStudent = data;
    }

    let saveResult: any;
    let saveError: any;

    const updatePayload: Record<string, any> = {
      full_name: fullName.trim(),
      college_email: user.email || existingStudent?.college_email || "",
      college_id: finalCollegeId,
      custom_institution_name: finalCustomName || customInstitutionName || null,
      institution_source: finalSource,
      institution_verified: finalVerified,
      branch: branch?.trim() || "Computer Science",
      cgpa: parsedCgpa,
      batch_year: parsedBatchYear,
      is_verified: finalVerified,
      updated_at: new Date().toISOString()
    };

    if (existingStudent) {
      if (existingStudent.id !== user.id) {
        updatePayload.id = user.id;
      }

      let res = await dbClient
        .from("students")
        .update(updatePayload)
        .eq("id", existingStudent.id)
        .select()
        .maybeSingle();

      if (res.error) {
        res = await supabase
          .from("students")
          .update(updatePayload)
          .eq("id", existingStudent.id)
          .select()
          .maybeSingle();
      }

      saveResult = res.data;
      saveError = res.error;
    } else {
      let res = await dbClient
        .from("students")
        .insert({
          id: user.id,
          ...updatePayload
        })
        .select()
        .maybeSingle();

      if (res.error) {
        res = await supabase
          .from("students")
          .insert({
            id: user.id,
            ...updatePayload
          })
          .select()
          .maybeSingle();
      }

      saveResult = res.data;
      saveError = res.error;
    }

    if (saveError) {
      console.error("Error saving student profile:", saveError.message);
      return NextResponse.json({ error: `Failed to save profile: ${saveError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      student: saveResult
    });
  } catch (error: any) {
    console.error("Student profile update error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}


