"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { ShieldAlert, RefreshCw } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, hasPageAccess } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    // 1. Not logged in -> Redirect to /login
    if (!user) {
      if (!isLoginPage) {
        router.replace("/login");
      }
      return;
    }

    // 2. Already logged in and visiting /login -> Redirect to appropriate home page
    if (isLoginPage) {
      if (user.role === "super_admin") {
        router.replace("/dashboard");
      } else {
        router.replace("/pos-billing");
      }
      return;
    }

    // 3. Check Route Permissions for Staff
    if (user.role === "staff") {
      const allowed = hasPageAccess(pathname);
      if (!allowed) {
        toast.error("Access Denied: You do not have permission to view this module.");
        // Redirect to first allowed page or /pos-billing
        const target =
          user.allowedPages && user.allowedPages.length > 0
            ? user.allowedPages[0]
            : "/pos-billing";
        router.replace(target);
      }
    }
  }, [user, loading, pathname, isLoginPage, hasPageAccess, router, toast]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/10 p-3 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-xl animate-pulse">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
          <span>Securing workspace session...</span>
        </div>
      </div>
    );
  }

  // If on login page, just render login component
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not logged in, block rendering while redirecting
  if (!user) {
    return null;
  }

  // If staff has no permission on this route, show access denied placeholder while redirecting
  if (user.role === "staff" && !hasPageAccess(pathname)) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-200 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Restricted Access</h2>
        <p className="text-xs text-slate-500 max-w-md mb-6">
          Your staff account does not have permission to access the requested page or store.
          Redirecting to authorized workspace...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
