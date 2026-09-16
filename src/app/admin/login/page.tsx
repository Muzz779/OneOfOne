import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/server/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return <LoginForm />;
}
