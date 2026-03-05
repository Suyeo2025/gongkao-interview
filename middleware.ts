import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "gongkao_auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];
const ADMIN_PATHS = ["/admin", "/api/admin"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAdminOnly(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (isPublic(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "服务器配置错误" }, { status: 500 });
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    const userId = payload.userId as string;
    const role = payload.role as string;

    // Old token format (pre-account system) — force re-login
    if (!userId) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "请重新登录" }, { status: 401 });
      }
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    // Admin-only route check
    if (isAdminOnly(pathname) && role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "无管理员权限" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Inject user info into request headers for API routes
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", userId);
    requestHeaders.set("x-user-role", role);
    requestHeaders.set("x-username", (payload.username as string) || "");

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    // Invalid token — clear it and redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
