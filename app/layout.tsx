import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/hooks/theme-provider";
import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";
import { HydrationZustand } from "@/hooks/use-bucket-store";
import { ProgressProviders } from "@/components/ProgressBarProvider";

const readexPro = Readex_Pro({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "kapil.app secure file uploads",
  description: "Upload and manage personal files securely on kapil.app. Fast, secure, and user-friendly. Developed by Kapil Chaudhary.",
  keywords: "file upload, secure storage, Kapil App, cloud files, online file manager",
  authors: [{ name: "Kapil Chaudhary", url: "https://kapil.app" }],
  openGraph: {
    title: "Kapil App - Secure File Uploads",
    description: "Upload and manage your files securely with Kapil App.",
    url: "https://kapil.app",
    siteName: "Kapil App",
    images: [{ url: "https://kapil.app/og-image.png", width: 1200, height: 630, alt: "Kapil App" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${readexPro.className} antialiased bg-background text-neutral-900 dark:text-white`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <ProgressProviders>
          <svg
                  className="pointer-events-none fixed top-0 left-0 isolate z-50 opacity-25 dark:opacity-[0.15] mix-blend-normal"
                   width="100%"
                   height="100%"
                 >
                   <filter id="pedroduarteisalegend">
                     <feTurbulence
                       type="fractalNoise"
                       baseFrequency="0.80"
                       numOctaves="4"
                       stitchTiles="stitch"
                     />
                     <feColorMatrix type="saturate" values="0" />
                   </filter>
                   <rect width="100%" height="100%" filter="url(#pedroduarteisalegend)"></rect>
                 </svg>
                 <HydrationZustand />
          <main className="min-h-screen flex flex-col items-center p-0">
            {children}
          </main>
          <Toaster />
            </ProgressProviders>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
