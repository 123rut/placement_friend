import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error_description") || searchParams.get("error");

  // Determine the correct public origin
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host");

  let publicOrigin = origin;
  if (forwardedHost) {
    publicOrigin = `${forwardedProto}://${forwardedHost}`;
  } else if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    publicOrigin = `https://${host}`;
  }

  if (authError) {
    console.error("Supabase OAuth error returned:", authError);
    return NextResponse.redirect(`${publicOrigin}/login?error=${encodeURIComponent(authError)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore if called from Server Component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }

    console.error("OAuth code exchange error:", error);
    return NextResponse.redirect(
      `${publicOrigin}/login?error=${encodeURIComponent(error.message || "Could not exchange OAuth session")}`
    );
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=Could+not+authenticate+with+Google`);
}
