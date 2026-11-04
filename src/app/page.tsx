import { auth, devLoginEnabled, signIn, signOut } from "@/auth";
import DiaryApp from "@/components/DiaryApp";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  const { error } = await searchParams;

  async function loginGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  async function loginDev(fd: FormData) {
    "use server";
    if (!devLoginEnabled) return;
    await signIn("dev", { name: String(fd.get("name") ?? ""), redirectTo: "/" });
  }
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <DiaryApp
      user={session?.user?.id ? session.user : null}
      devLogin={devLoginEnabled}
      loginGoogle={loginGoogle}
      loginDev={loginDev}
      logout={logout}
      authError={error}
    />
  );
}
