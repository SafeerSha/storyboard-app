import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  let isSuperAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("freelancer_profiles").select("role, status").eq("id", user.id).single();
    if (profile?.status === "disabled") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (profile?.role === "super_admin") {
      isSuperAdmin = true;
    }
  }
  
  // Protect Freelancer routes.
  const protectedPath = pathname === "/" || pathname.startsWith("/clients") || pathname.startsWith("/projects") || pathname.startsWith("/project") || pathname.startsWith("/settings") || pathname.startsWith("/users");
  
  if (protectedPath && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/login" && user) return NextResponse.redirect(new URL("/", request.url));
  
  // Block non-admins from /users
  if (pathname.startsWith("/users") && user && !isSuperAdmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.jpg).*)",
  ],
};
