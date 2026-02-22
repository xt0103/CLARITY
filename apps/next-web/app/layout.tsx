import "./globals.css";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers/Providers";

export const metadata = {
  title: "CLARITY Job Seeker",
  description: "MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

