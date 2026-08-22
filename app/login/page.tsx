"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  Download,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Store,
  Sparkles,
  X,
} from "lucide-react";


export default function LoginPage() {
  const { user, loginSuperAdmin, sendStaffOtp, verifyStaffOtp } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // Active Tab: "admin" | "staff"
  const [activeTab, setActiveTab] = useState<"admin" | "staff">("admin");

  // Admin Form State
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  // Staff Form State
  const [staffPhone, setStaffPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

  // Listen for PWA beforeinstallprompt globally
  useEffect(() => {
    // Check if early prompt was already captured by layout script
    if (typeof window !== "undefined") {
      if ((window as any).__pwaDeferredPrompt) {
        setDeferredPrompt((window as any).__pwaDeferredPrompt);
      }

      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        (window as any).__pwaDeferredPrompt = e;
        setDeferredPrompt(e);
      };

      const handleDeferredReady = () => {
        if ((window as any).__pwaDeferredPrompt) {
          setDeferredPrompt((window as any).__pwaDeferredPrompt);
        }
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        (window as any).__pwaDeferredPrompt = null;
        setDeferredPrompt(null);
        toast.success("Natural Fresh App installed successfully!");
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("pwa-deferred-ready", handleDeferredReady);
      window.addEventListener("appinstalled", handleAppInstalled);

      // Check if already in standalone mode
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      ) {
        setIsInstalled(true);
      }

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("pwa-deferred-ready", handleDeferredReady);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, [toast]);

  // Resend Timer Countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Admin Login (Firebase Email/Password)
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.warning("Please enter your admin email and password.");
      return;
    }

    setAdminLoading(true);
    const result = await loginSuperAdmin(adminEmail, adminPassword);
    setAdminLoading(false);

    if (result.success) {
      toast.success("Welcome back, Super Admin!");
      router.replace("/dashboard");
    } else {
      toast.error(result.error || "Failed to authenticate Super Admin.");
    }
  };

  // Handle Staff Send OTP (Descope)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = staffPhone.trim().replace(/\D/g, "");
    if (!clean || clean.length < 10) {
      toast.warning("Please enter a valid 10-digit mobile number.");
      return;
    }

    setStaffLoading(true);
    const result = await sendStaffOtp(clean);
    setStaffLoading(false);

    if (result.success) {
      setOtpSent(true);
      setResendCooldown(45);
      toast.success(`OTP verification code sent to +91 ${clean}`);
    } else {
      toast.error(result.error || "Failed to send OTP. Please check mobile number.");
    }
  };

  // Handle Staff Verify OTP (Descope + Staff DB)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      toast.warning("Please enter the OTP verification code.");
      return;
    }

    setStaffLoading(true);
    const result = await verifyStaffOtp(staffPhone, otpCode.trim());
    setStaffLoading(false);

    if (result.success) {
      toast.success("Staff authenticated successfully!");
      // Redirect staff directly to POS billing page
      router.replace("/pos-billing");
    } else {
      toast.error(result.error || "Invalid OTP code. Please try again.");
    }
  };

  // Handle PWA Install Button Click
  const handleInstallApp = async () => {
    const promptObj = (window as any).__pwaDeferredPrompt || deferredPrompt;

    if (promptObj) {
      try {
        promptObj.prompt();
        const choiceResult = await promptObj.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsInstalled(true);
          toast.success("Natural Fresh App installed successfully!");
        }
        (window as any).__pwaDeferredPrompt = null;
        setDeferredPrompt(null);
      } catch (e) {
        console.warn("Prompt error:", e);
        setIsInstallGuideOpen(true);
      }
    } else {
      // Show device-specific install guide modal
      setIsInstallGuideOpen(true);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar Brand & PWA Install Button */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-white p-1 shadow-md border border-white/20 flex items-center justify-center">
            <img src="/logo.png" alt="Natural Fresh" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-lg font-extrabold text-white tracking-tight">Natural Fresh</span>
            <span className="block text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
              Retail & POS Management
            </span>
          </div>
        </div>

        {/* PWA Install Button */}
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>App Installed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallApp}
              id="install-pwa-btn"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 animate-bounce" />
              <span>Install PWA App</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-md mx-auto my-auto z-10 py-6">
        <div className="bg-white/95 backdrop-blur-xl rounded-[12px] border border-white/20 shadow-2xl overflow-hidden">
          {/* Header Banner */}
          <div className="p-6 pb-4 text-center border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select your role to access store management and POS billing.
            </p>

            {/* Role Switcher Tabs */}
            <div className="mt-5 grid grid-cols-2 p-1 bg-slate-200/80 rounded-[8px] gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("admin");
                  setOtpSent(false);
                }}
                className={`py-2 px-3 rounded-[6px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Super Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("staff");
                }}
                className={`py-2 px-3 rounded-[6px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "staff"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Staff (OTP)</span>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6">
            {/* ======================================================== */}
            {/* TAB 1: SUPER ADMIN LOGIN (EMAIL & PASSWORD) */}
            {/* ======================================================== */}
            {activeTab === "admin" && (
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Super Admin Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="admin@naturalfresh.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full h-[40px] pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full h-[40px] pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminLoading}
                  className="w-full h-[42px] mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {adminLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Login to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="p-2.5 rounded-[6px] bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Super Admin credentials provide unrestricted access across all stores and modules.
                  </span>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 2: STAFF LOGIN (DESCOPE MOBILE NUMBER OTP) */}
            {/* ======================================================== */}
            {activeTab === "staff" && (
              <div className="space-y-4">
                {!otpSent ? (
                  // Step 1: Enter Mobile Number
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Registered Mobile Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 text-xs font-bold">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          placeholder="9876543210"
                          value={staffPhone}
                          onChange={(e) =>
                            setStaffPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                          className="w-full h-[40px] pl-12 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-900 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all tracking-wider"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        We will send a 6-digit OTP code to verify your staff account.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={staffLoading || staffPhone.length < 10}
                      className="w-full h-[42px] bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {staffLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send OTP via SMS</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                      <Store className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        Upon verification, you will be redirected straight to POS Billing for your assigned store.
                      </span>
                    </div>
                  </form>
                ) : (
                  // Step 2: Verify OTP
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-[6px] border border-blue-200 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-blue-800 font-medium">OTP Sent To:</p>
                        <p className="text-xs font-bold text-blue-950 font-mono">+91 {staffPhone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Enter 6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        required
                        placeholder="••••••"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full h-[44px] text-center tracking-[0.5em] text-lg font-extrabold font-mono bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={staffLoading || otpCode.length < 6}
                      className="w-full h-[42px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-[6px] text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {staffLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify & Access POS</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400">Didn't receive code?</span>
                      {resendCooldown > 0 ? (
                        <span className="text-slate-400 font-mono font-semibold">
                          Resend in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Branding & Install Help */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 z-10 border-t border-white/10 pt-4">
        <p>© {new Date().getFullYear()} Natural Fresh Official. All Rights Reserved.</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>PWA Ready & Auto-Updating</span>
          </span>
        </div>
      </footer>

      {/* PWA Install Guide Modal for Windows, Android, iOS */}
      {isInstallGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 p-0.5 flex items-center justify-center">
                  <img src="/app-icon.jpeg" alt="Icon" className="w-full h-full object-cover rounded-[4px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install Natural Fresh App</h3>
                  <p className="text-[10px] text-slate-300">Fast 1-tap launcher for your device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstallGuideOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-[8px] flex items-center gap-3">
                <div className="w-12 h-12 rounded-[8px] bg-white p-1 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-blue-200">
                  <img src="/app-icon.jpeg" alt="Icon" className="w-full h-full object-cover rounded-[6px]" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">Natural Fresh POS</p>
                  <p className="text-[11px] text-slate-500">Standalone App • Offline Enabled</p>
                </div>
              </div>

              {/* Windows & Desktop Guide */}
              <div className="space-y-2">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                  <span>On Windows / PC (Chrome / Edge):</span>
                </p>
                <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-[11px] space-y-1 text-slate-600">
                  <p>• Look at your browser address bar on the top-right.</p>
                  <p>• Click the <strong>Install App icon (💻 or ⊕)</strong>.</p>
                  <p>• Or click the 3 dots <strong>(⋮) ➔ &quot;Install Natural Fresh&quot;</strong>.</p>
                </div>
              </div>

              {/* Android Guide */}
              <div className="space-y-2">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">2</span>
                  <span>On Android Phone or Tablet:</span>
                </p>
                <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-[11px] space-y-1 text-slate-600">
                  <p>• Tap the 3 dots <strong>(⋮)</strong> in Chrome at the top right.</p>
                  <p>• Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
                </div>
              </div>

              {/* iOS Guide */}
              <div className="space-y-2">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">3</span>
                  <span>On iPhone / iPad (Safari):</span>
                </p>
                <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-[11px] space-y-1 text-slate-600">
                  <p>• Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</p>
                  <p>• Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsInstallGuideOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-colors cursor-pointer"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

