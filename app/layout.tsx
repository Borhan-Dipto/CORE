import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { getLang, getTheme } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CORE", template: "%s · CORE" },
  description: "CORE — Business Operating System. One platform. Every business. Complete control.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8fafc" }, { media: "(prefers-color-scheme: dark)", color: "#101113" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);
  return (
    <html lang={lang} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        {theme === "system" && (
          <script dangerouslySetInnerHTML={{ __html: "if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')" }} />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" theme={theme === "system" ? "system" : theme} richColors closeButton
          toastOptions={{ classNames: { toast: "!rounded-lg !border-border !shadow-pop !font-sans" } }} />
      </body>
    </html>
  );
}
