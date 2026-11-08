import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trending Radar · GitHub Intelligence",
  description: "Live multi-agent analytics on GitHub trending repositories, powered by LangGraph + Groq.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
