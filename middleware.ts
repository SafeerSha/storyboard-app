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
  
  // Protect Freelancer routes.
  // Note: /client is NOT in this list, because it uses custom client auth.
  const protectedPath = pathname === "/" || pathname.startsWith("/clients") || pathname.startsWith("/projects") || pathname.startsWith("/project") || pathname.startsWith("/settings");
  
  if (protectedPath && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/login" && user) return NextResponse.redirect(new URL("/", request.url));
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.jpg).*)",
  ],
};
