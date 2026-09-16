import { Studio } from "@/components/studio/studio";

export const metadata = {
  title: "Design Studio — OneOfOne",
  description:
    "Upload your artwork, check it's print-ready, and position it on real apparel.",
};

// The editor is a client tool; keep it dynamic (it uses signed URLs & sessions).
export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string | string[] }>;
}) {
  const sp = await searchParams;
  const design = typeof sp.design === "string" ? sp.design : undefined;
  return <Studio initialDesignId={design} />;
}
