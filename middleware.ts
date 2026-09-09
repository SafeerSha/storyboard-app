import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const TEAM_COOKIE = "storyboard_team_session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Team Portal route protections (Early exit: zero Supabase Auth API calls)
  const hasTeamSession = Boolean(request.cookies.get(TEAM_COOKIE)?.value);
  if (pathname === "/login") {
    // Allow access to login page. Never blindly redirect to /team based solely on
    // raw cookie presence, as an expired/invalid token causes an infinite bounce loop.
    // We do not need the early return here for /login since we are using /login.
    // The regular /login check later in the file will handle logged-in user redirection if needed.
  }

  if (pathname === "/team" || pathname.startsWith("/team/")) {
    if (!hasTeamSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  // 2. Client Portal routes (Early exit: zero Supabase Auth API calls)
  if (pathname === "/client" || pathname.startsWith("/client/")) {
    return NextResponse.next({ request });
  }

  // 3. Supabase Auth for Freelancer / Admin routes
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect Freelancer routes
  const isInboxPath = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const protectedFreelancerPath =
    pathname === "/" ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/users");

  if (isInboxPath) {
    if (!user && !hasTeamSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else if (protectedFreelancerPath && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }


  // Super Admin & Profile verification
  let isSuperAdmin = false;
  let profileName = "";
  let profileRole = "freelancer";

  if (user) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("freelancer_profiles")
      .select("name, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "disabled") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (profile?.role === "super_admin") {
      isSuperAdmin = true;
    }
    profileRole = profile?.role || "freelancer";
    profileName =
      profile?.name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Freelancer";

    // Block non-admins from /users
    if (pathname.startsWith("/users") && !isSuperAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Attach verified user identity headers to forward down to Server Components
    // This avoids duplicate auth.getUser() + freelancer_profiles queries in layout.tsx
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email || "");
    requestHeaders.set("x-user-role", profileRole);
    requestHeaders.set("x-user-name", encodeURIComponent(profileName));

    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.jpg).*)"],
};
