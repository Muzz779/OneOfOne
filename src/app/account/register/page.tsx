import { redirect } from "next/navigation";
import { AuthForm } from "@/components/account/auth-form";
import { getCurrentUser } from "@/server/session";

export const metadata = { title: "Create account — OneOfOne" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <AuthForm mode="register" />
    </main>
  );
}
