import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { upsertUser } from "@/lib/users";

// 로컬 개발에서 Google 키 없이 화면을 시험하기 위한 계정. 배포(Vercel)에서는 절대 켜지지 않는다.
export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "1" && !process.env.VERCEL;

// 초대한 사람만 로그인: Vercel 환경 변수 ALLOWED_EMAILS 에 쉼표로 구분한 이메일 명단을 넣는다.
// 명단이 비어 있으면 지금처럼 누구나 로그인할 수 있다. (명단은 코드·깃에 넣지 않는다)
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const providers: Provider[] = [Google];
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "로컬 테스트",
      credentials: { name: { label: "이름" } },
      authorize: async (c) => {
        const name = String(c?.name || "tester").slice(0, 30);
        const slug = name.replace(/[^a-z0-9]/gi, "").toLowerCase() || "tester";
        return { id: `dev-${slug}`, email: `${slug}@dev.local`, name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/", error: "/" },
  trustHost: true,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google" || allowedEmails.length === 0) return true;
      const email = String(profile?.email ?? user?.email ?? "").toLowerCase();
      return allowedEmails.includes(email); // 명단에 없으면 /?error=AccessDenied 로 돌아간다
    },
    async jwt({ token, account, profile, user }) {
      // 첫 로그인(또는 재로그인) 때만 users 테이블에 회원을 만들거나 찾아서 내부 id를 토큰에 넣는다.
      if (account) {
        const sub = account.provider === "google" ? String(profile?.sub ?? account.providerAccountId) : String(user?.id);
        const email = String(profile?.email ?? user?.email ?? token.email);
        const row = await upsertUser({
          sub: `${account.provider}:${sub}`,
          email,
          name: (profile?.name as string) ?? user?.name ?? null,
          image: (profile?.picture as string) ?? user?.image ?? null,
        });
        token.uid = row.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
