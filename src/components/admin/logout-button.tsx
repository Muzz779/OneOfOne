"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="border-2 border-ink bg-paper px-3 py-1 text-sm font-bold hover:bg-accent hover:text-white"
    >
      Log out
    </button>
  );
}
