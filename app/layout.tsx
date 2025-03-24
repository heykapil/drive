import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/hooks/theme-provider";
import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";
import { HydrationZustand } from "@/hooks/use-bucket-store";
import { ProgressProviders } from "@/components/ProgressBarProvider";
import HeaderNav from "@/components/header-nav";
import { getSession } from "@/lib/auth";
import TransitionLayout from "@/components/TransitionLayout";

const readexPro = Readex_Pro({
  subsets: ["latin"],
});

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
  icons: {
    apple: [
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-180x180.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-57x57.png',
        sizes: '57x57',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-76x76.png',
        sizes: '76x76',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/applce-icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-120x120.png',
        sizes: '120x120',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-114x114.png',
        sizes: '114x114',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-60x60.png',
        sizes: '60x60',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/apple-icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
      },
      {
        url: 'https://cf.kapil.app/images/website/favicons/favicon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
    ],
    other: [
      {
        rel: 'icon',
        url: 'https://cf.kapil.app/images/website/favicons/favicon.ico',
      },
      {
        rel: 'icon',
        url: 'https://cf.kapil.app/images/website/favicons/android-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        rel: 'icon',
        url: 'https://cf.kapil.app/images/website/favicons/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        rel: 'manifest',
        url: 'https://cf.kapil.app/images/website/favicons/manifest.json',
      },
    ],
    icon: 'https://cf.kapil.app/images/website/favicons/favicon-16x16.png',
  },
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession()
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
              <HeaderNav session={session} />
               <TransitionLayout>
                 {children}
               </TransitionLayout>
            </main>
          <Toaster theme="system" expand richColors />
            </ProgressProviders>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
