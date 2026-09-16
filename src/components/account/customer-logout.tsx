"use client";

import { useRouter } from "next/navigation";

export function CustomerLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="border-2 border-ink bg-paper px-3 py-1.5 text-sm font-bold hover:bg-accent hover:text-white"
    >
      Sign out
    </button>
  );
}
