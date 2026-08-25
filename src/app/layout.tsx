import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClusterProvider } from "@/lib/context/ClusterContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kafka, Operationally — an interactive systems guide",
  description:
    "An interactive Kafka guide for developers, platform engineers, and SREs: concepts, hands-on labs, configuration experiments, and incident simulation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jbMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ClusterProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-h-screen flex-1 flex-col">
              <TopBar />
              <main className="flex-1 px-6 py-10 sm:px-10">{children}</main>
            </div>
          </div>
        </ClusterProvider>
      </body>
    </html>
  );
}
