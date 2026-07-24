import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProtoMatiks | AI Content Moderation",
  description:
    "Political content moderation prototype for the ProtoMatiks platform. " +
    "Lightweight, real-time vision evaluation proxy using Groq AI.",
  keywords: ["content moderation", "AI", "political content", "ProtoMatiks", "Groq"],
  authors: [{ name: "ProtoMatiks" }],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
