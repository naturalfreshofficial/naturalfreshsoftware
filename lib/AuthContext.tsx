"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AuthSession, Staff, UserRole } from "@/lib/types";
import {
  sendDescopeSmsOtp,
  verifyDescopeSmsOtp,
  normalizePhoneForLookup,
} from "@/lib/descope";
import { isStaffAllowedRoute } from "@/lib/pagesConfig";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: AuthSession | null;
  staffData: Staff | null;
  loading: boolean;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  loginSuperAdmin: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  sendStaffOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyStaffOtp: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPageAccess: (pathname: string) => boolean;
  hasBranchAccess: (branchId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "retailnext_auth_session";
const LOCAL_STORAGE_BRANCH_KEY = "retailnext_selected_branch";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();

  // Update selected branch and store in local storage
  const setSelectedBranchId = useCallback((id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, id);
    }
  }, []);

  // 1. Initialize Auth on Mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
        const storedBranch = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY) : null;

        if (stored) {
          const parsedSession: AuthSession = JSON.parse(stored);
          setUser(parsedSession);
          if (storedBranch) {
            setSelectedBranchIdState(storedBranch);
          } else if (parsedSession.currentBranchId) {
            setSelectedBranchIdState(parsedSession.currentBranchId);
          }
        }

        // Also check Firebase Auth state
        const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
          if (fbUser) {
            // If logged in via Firebase Auth, confirm super_admin
            const session: AuthSession = {
              uid: fbUser.uid,
              role: "super_admin",
              name: fbUser.displayName || fbUser.email?.split("@")[0] || "Super Admin",
              email: fbUser.email || undefined,
            };
            setUser(session);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Auth init error:", err);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 2. Real-time Staff Sync: if staff permissions change in Firestore, auto-sync session
  useEffect(() => {
    if (!user || user.role !== "staff" || !user.staffDocId) {
      setStaffData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "staff", user.staffDocId), (docSnap) => {
      if (docSnap.exists()) {
        const staff = { id: docSnap.id, ...docSnap.data() } as Staff;
        // If staff got deactivated, log out immediately
        if (staff.status === "inactive") {
          logout();
          return;
        }

        setStaffData(staff);
        const updatedSession: AuthSession = {
          ...user,
          name: staff.name,
          phone: staff.phone,
          allowedPages: staff.allowedPages || [],
          branchIds: staff.branchIds || [],
        };
        setUser(updatedSession);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSession));
      } else {
        // Staff deleted from DB
        logout();
      }
    });

    return () => unsub();
  }, [user?.staffDocId, user?.role]);

  // 3. Super Admin Login (Firebase Email/Password)
  const loginSuperAdmin = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const session: AuthSession = {
        uid: cred.user.uid,
        role: "super_admin",
        name: cred.user.displayName || cred.user.email?.split("@")[0] || "Super Admin",
        email: cred.user.email || email.trim(),
      };
      setUser(session);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      let msg = "Invalid email or password. Please try again.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Invalid admin credentials. Please check your email and password.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Please wait a few minutes.";
      }
      return { success: false, error: msg };
    }
  };

  // 4. Send Staff OTP (Descope SMS OTP)
  const sendStaffOtp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanPhone = normalizePhoneForLookup(phone);
      if (!cleanPhone || cleanPhone.length < 10) {
        return { success: false, error: "Please enter a valid 10-digit mobile number." };
      }

      // Pre-check if staff exists and is active in Firestore
      const q = query(
        collection(db, "staff"),
        where("phone", "==", cleanPhone),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Also check if phone stored with other formats (e.g. without leading zeros)
        return {
          success: false,
          error: "Mobile number is not registered as an active staff member. Please contact Super Admin.",
        };
      }

      // Send OTP via Descope
      const res = await sendDescopeSmsOtp(cleanPhone);
      if (!res.ok) {
        return { success: false, error: res.message || "Failed to send SMS OTP via Descope." };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to send OTP." };
    }
  };

  // 5. Verify Staff OTP (Descope + Firestore Permissions Load)
  const verifyStaffOtp = async (
    phone: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanPhone = normalizePhoneForLookup(phone);
      if (!cleanPhone || !code) {
        return { success: false, error: "Mobile number and verification code are required." };
      }

      // Verify OTP with Descope
      const verifyRes = await verifyDescopeSmsOtp(cleanPhone, code);
      if (!verifyRes.ok) {
        return { success: false, error: verifyRes.message || "Invalid or expired OTP." };
      }

      // Fetch Staff Record from Firestore
      const q = query(
        collection(db, "staff"),
        where("phone", "==", cleanPhone),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        return {
          success: false,
          error: "Mobile number is not registered as active staff. Access denied.",
        };
      }

      const staffDoc = snap.docs[0];
      const staff = { id: staffDoc.id, ...staffDoc.data() } as Staff;

      const initialBranch = staff.branchIds?.[0] || "";

      const session: AuthSession = {
        uid: staff.id,
        role: "staff",
        name: staff.name,
        phone: staff.phone,
        email: staff.email,
        allowedPages: staff.allowedPages || [],
        branchIds: staff.branchIds || [],
        currentBranchId: initialBranch,
        staffDocId: staff.id,
      };

      setStaffData(staff);
      setUser(session);
      if (initialBranch) {
        setSelectedBranchIdState(initialBranch);
        localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, initialBranch);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));

      return { success: true };
    } catch (err: any) {
      console.error("Staff verify error:", err);
      return { success: false, error: err.message || "Verification failed." };
    }
  };

  // 6. Logout
  const logout = async () => {
    try {
      await fbSignOut(auth).catch(() => {});
    } catch (e) {}
    setUser(null);
    setStaffData(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_BRANCH_KEY);
    }
    router.replace("/login");
  };

  // 7. Route Permission Checker
  const hasPageAccess = (routePath: string): boolean => {
    if (!user) return false;
    if (user.role === "super_admin") return true;

    // Staff access rules
    return isStaffAllowedRoute(routePath, user.allowedPages || []);
  };

  // 8. Branch Permission Checker
  const hasBranchAccess = (branchId: string): boolean => {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    if (!branchId || branchId === "all") return false;
    return Boolean(user.branchIds?.includes(branchId));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staffData,
        loading,
        selectedBranchId,
        setSelectedBranchId,
        loginSuperAdmin,
        sendStaffOtp,
        verifyStaffOtp,
        logout,
        hasPageAccess,
        hasBranchAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
