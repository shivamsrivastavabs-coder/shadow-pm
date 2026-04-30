import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadow PM",
  description: "AI shadow PM — v0"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
