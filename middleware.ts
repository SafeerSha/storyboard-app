import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isClientDomain } from "@/lib/domains";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  const pathname = url.pathname;

  // 1. Check if the request is from the client domain
  if (isClientDomain(hostname)) {
    // We rewrite public clean URLs to internal /client routes
    
    // If they visit /login on the client domain -> map to /client/login
    if (pathname === "/login") {
      return NextResponse.rewrite(new URL("/client/login", request.url));
    }
    
    // If they visit / on the client domain -> map to /client
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/client", request.url));
    }

    // Allow /api/client/* requests to pass through
    if (pathname.startsWith("/api/client/")) {
      return NextResponse.next();
    }

    // Do NOT allow access to internal routes publicly as /client or /client/*
    // They should be accessed via rewritten paths. We can just 404 anything else.
    // However, if they directly try to access /client via the client domain, we 404 it
    // to force them to use the clean URLs. Wait, rewrite happens after this so we just 404 any direct access.
    if (pathname.startsWith("/client")) {
      return new NextResponse(null, { status: 404 });
    }

    // For any other path on the client domain, return 404
    return new NextResponse(null, { status: 404 });
  }

  // 2. The request is from the Freelancer domain
  
  // Block freelancer domain from accessing client routes
  if (pathname === "/client" || pathname.startsWith("/client/") || pathname.startsWith("/api/client/")) {
    return new NextResponse(null, { status: 404 });
  }

  // Proceed with existing Supabase Auth for Freelancer
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
