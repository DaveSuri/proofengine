import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Technical BA Agent | Engineering-Ready PRD & Technical Business Analysis",
  description:
    "Turn ambiguous business requirements into engineering-ready specifications via an 8-stage multi-agent Technical Business Analysis pipeline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
