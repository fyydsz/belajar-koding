import { RootProvider } from '@fumadocs/base-ui/provider/next';
import './global.css';
import 'katex/dist/katex.css';
import { Geist } from 'next/font/google';
import { cn } from "@/lib/utils";
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen antialiased">
        <RootProvider theme={{ defaultTheme: 'dark' }}>
          {children}
          <Toaster richColors position="bottom-right" />
        </RootProvider>
      </body>
    </html>
  );
}
