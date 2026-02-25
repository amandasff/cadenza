import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";

export const metadata: Metadata = {
  title: "Cadenza — Music Practice",
  description: "The async music teaching platform for teachers and students",
};

// Inline script: reads localStorage and sets data-theme before first paint,
// preventing a flash of the wrong theme on reload.
const themeScript = `
  try {
    var t = localStorage.getItem('cadenza-theme');
    if (t === 'elegant') document.documentElement.setAttribute('data-theme', 'elegant');
  } catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
