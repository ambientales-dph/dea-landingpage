import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  title: 'DEA TL',
  description: 'Tu repositorio de archivos personal en la nube con una línea de tiempo interactiva.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head />
      <body className="antialiased font-sans">
          <FirebaseClientProvider>
            {children}
            <Toaster />
            <FirebaseErrorListener />
          </FirebaseClientProvider>
      </body>
    </html>
  );
}
