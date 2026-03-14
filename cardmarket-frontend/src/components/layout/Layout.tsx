import type { ReactNode } from "react";
import Navbar from "./Navbar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
