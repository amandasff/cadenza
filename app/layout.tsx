import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { I18nProvider } from "@/lib/context/I18nContext";
import LessonProviderClient from "@/components/LessonProviderClient";
import FeedbackWidget from "@/components/FeedbackWidget";
import SupportChatWidget from "@/components/SupportChatWidget";
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
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider>
              <LessonProviderClient>{children}</LessonProviderClient>
              <SupportChatWidget />
              <FeedbackWidget />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
