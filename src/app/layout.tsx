import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { UserProvider, UserInfo } from "@/lib/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "公考面试模拟助手",
  description: "AI 驱动的公务员面试模拟练习工具，五板块结构化作答",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

async function getUser(): Promise<UserInfo | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("gongkao_auth")?.value;
    if (!token) return null;
    const secret = process.env.AUTH_SECRET || "UriM4dBv+Mhmd8i/EboKr5vuzDVa76my+K/f4PCju4U=";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return {
      id: payload.userId as string,
      username: payload.username as string,
      role: payload.role as "admin" | "member",
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="antialiased font-sans">
        <UserProvider initial={user}>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
