import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SchoolLens",
  description:
    "Evidence-backed school information for parents — confidence you can see.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-border/80 bg-white px-4 py-6">
          <p className="mx-auto max-w-5xl text-sm text-muted-foreground">
            SchoolLens cites sources and labels confidence. It does not rank
            schools or invent missing facts.
          </p>
        </footer>
      </body>
    </html>
  );
}
