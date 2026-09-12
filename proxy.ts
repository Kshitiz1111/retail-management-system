import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = ["/", "/login", "/register", "/setup", "/store", "/store/[slug]"];

// Admin routes that require specific roles
const adminRoutes = ["/admin"];
const managerRoutes = ["/admin/inventory", "/admin/vendors"];
const staffRoutes = ["/pos"];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (publicRoutes.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Get auth token from cookies or headers
    const token = request.cookies.get("authToken")?.value;

    // For protected routes, we'll check authentication in the page component
    // This middleware provides basic route protection
    // Full permission checking happens in page components using useAuth hook

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
