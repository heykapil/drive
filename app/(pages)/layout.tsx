import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/hooks/theme-provider";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { HydrationZustand } from "@/hooks/use-bucket-store";
import { ProgressProviders } from "@/components/ProgressBarProvider";
import HeaderNav, { HeaderSkeleton } from "@/components/header-nav";
import { getSession } from "@/lib/auth";
import TransitionLayout from "@/components/TransitionLayout";
import { Suspense } from "react";
import { Toaster } from "sonner";
import type { Viewport } from 'next'
import { bucketOptions } from "@/service/bucket.config";

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f5f9' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
}

// const readexPro = Readex_Pro({
//   subsets: ["latin"],
// });

const DMSans = DM_Sans({
  subsets: ['latin', 'latin-ext']
  })

export const metadata: Metadata = {
  metadataBase: new URL('https://drive.kapil.app'),
  title: {
    default: 'Kapil Chaudhary',
    template: '%s | Kapil Chaudhary',
  },
  description: 'Developer, writer, and creator.',
  openGraph: {
    title: 'Kapil Chaudhary',
    description: 'Developer, writer, and creator.',
    url: 'https://drive.kapil.app',
    siteName: 'Kapil Chaudhary',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: `https://og.kapil.app/api/og?title=Kapil Chaudhary&subtitle=Research scholar&bg=https://cf.kapil.app/images/kapiljch-20220503-0001.jpg`,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    title: 'Kapil Chaudhary',
    card: 'summary_large_image',
  },
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const bucketOption = await bucketOptions();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${DMSans.className} antialiased bg-background text-neutral-900 dark:text-white`}>
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
              <Suspense fallback={<HeaderSkeleton />}>
              <HeaderNav session={session} bucketOptions={bucketOption} />
              </Suspense>
               <TransitionLayout>
                 <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
                   <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
                     <div className="w-[95vw] md:w-2xl lg:w-4xl mx-auto py-6 space-y-6">
                       {children}
                     </div>
                    </main>
                  </div>
               </TransitionLayout>
            </main>
              <Toaster theme="system" expand richColors/>
            </ProgressProviders>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
