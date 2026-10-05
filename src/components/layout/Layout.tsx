import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
  // Locked mode: no navigation (logo/menu disabled) — used on the
  // reservation page while the guest is waiting for admin release.
  locked?: boolean;
}

export function Layout({ children, locked = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header locked={locked} />
      <main className="flex-1 flex flex-col pt-16 md:pt-20">
        {children}
      </main>
      <Footer locked={locked} />
    </div>
  );
}
