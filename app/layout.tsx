import "@/app/globals.css";
import { Figtree } from 'next/font/google';

const FigTree = Figtree({
  subsets: ['latin'],
});

export default function ROOTLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${FigTree.className} antialiased bg-background text-neutral-900 dark:text-white`}>{children}</body>
    </html>
  );
}
