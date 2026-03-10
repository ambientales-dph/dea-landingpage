import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { ProjectProvider } from "@/providers/project-provider";

export const metadata: Metadata = {
  title: "DEA",
  description: "Departamento de Estudios Ambientales",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ProjectProvider>
            {children}
            <Toaster />
          </ProjectProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
