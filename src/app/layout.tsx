import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "OneOfOne — Upload anything. We make it print-ready.",
  description:
    "South African custom print-on-demand apparel. Upload any image, we assess and enhance it, position it on real garments, and produce a genuine print-ready file.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center border-2 border-ink bg-accent text-white font-display font-bold shadow-[2px_2px_0_0_var(--ink)]">
            1
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            OneOfOne
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-3">
          <Link
            href="/studio"
            className="px-2 py-1 hover:underline underline-offset-4"
          >
            Studio
          </Link>
          <Link
            href="/studio"
            className="btn-raw px-3 py-1.5 text-sm"
          >
            Start a design
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono">
          OneOfOne · Custom apparel, printed in South Africa
        </span>
        <span className="font-mono text-xs">
          Preview build · prices shown are indicative
        </span>
      </div>
    </footer>
  );
}
