import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { I18nProvider } from "@/lib/context/I18nContext";
import LessonProviderClient from "@/components/LessonProviderClient";
import HelpWidget from "@/components/HelpWidget";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2C2824",
};

export const metadata: Metadata = {
  title: "Cadenza",
  description: "Make practice fun for music learners",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cadenza",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#2C2824",
  },
};

// Inline script: reads localStorage and sets data-theme before first paint,
// preventing a flash of the wrong theme on reload.
const themeScript = `
  try {
    var t = localStorage.getItem('cadenza-theme');
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* FIGMA_CAPTURE_SCRIPT */}
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
        {/* Preconnect to Google Fonts for faster load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload critical font weights to eliminate FOUT on first paint */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=block"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=block"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider>
              <LessonProviderClient>{children}</LessonProviderClient>
              <HelpWidget />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
