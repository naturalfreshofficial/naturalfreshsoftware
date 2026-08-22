"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";
import PWAUpdater from "@/components/PWAUpdater";
import MobileBottomNav from "@/components/MobileBottomNav";
import MobileMenuDrawer from "@/components/MobileMenuDrawer";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Fetch branches for mobile drawer
  useEffect(() => {
    if (isLoginPage) return;
    const unsub = onSnapshot(collection(db, "branches"), (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Branch);
      });
      setBranches(list);
    });
    return () => unsub();
  }, [isLoginPage]);

  return (
    <AuthGuard>
      <PWAUpdater />
      {isLoginPage ? (
        <main className="w-full h-full min-h-screen">{children}</main>
      ) : (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Area */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 scrollbar-thin">
              {children}
            </main>
          </div>

          {/* Mobile Sticky Bottom Tab Bar */}
          <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />

          {/* Mobile All Menu Cards Drawer */}
          <MobileMenuDrawer
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            branches={branches}
          />
        </div>
      )}
    </AuthGuard>
  );
}
