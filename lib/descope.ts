import DescopeClient from "@descope/web-js-sdk";

const projectId =
  process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID || "P3B770W2k4p5Y7dFk4q1Z9w0X0y";

// Initialize Descope SDK instance
export const descope = typeof window !== "undefined"
  ? DescopeClient({
      projectId,
      persistTokens: true,
      autoRefresh: true,
    })
  : null;

/**
 * Standardize mobile number to E.164 format (defaults to +91 for 10-digit India numbers)
 */
export function formatToE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Strip phone number to standard 10-digit format for matching in Firestore
 */
export function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Send SMS OTP using Descope SDK
 */
export async function sendDescopeSmsOtp(phoneNumber: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const formattedPhone = formatToE164(phoneNumber);

    if (!descope) {
      // Fallback direct REST request if SDK is not initialized
      const res = await fetch(`https://api.descope.com/v1/auth/otp/signUpOrIn/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}`,
        },
        body: JSON.stringify({ loginId: formattedPhone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.errorMessage || data.message || `Descope API error (${res.status})`);
      }
      return { ok: true };
    }

    const resp = await descope.otp.signUpOrIn.sms(formattedPhone);
    if (!resp.ok) {
      throw new Error(resp.error?.errorDescription || resp.error?.errorMessage || "Failed to send OTP via SMS");
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Descope send SMS error:", err);
    return {
      ok: false,
      message: err.message || "Failed to send OTP. Please verify your mobile number and Descope Project ID.",
    };
  }
}

/**
 * Verify SMS OTP using Descope SDK
 */
export async function verifyDescopeSmsOtp(
  phoneNumber: string,
  code: string
): Promise<{ ok: boolean; sessionJwt?: string; message?: string }> {
  try {
    const formattedPhone = formatToE164(phoneNumber);

    if (!descope) {
      const res = await fetch(`https://api.descope.com/v1/auth/otp/verify/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${projectId}`,
        },
        body: JSON.stringify({ loginId: formattedPhone, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.errorMessage || data.message || "Invalid or expired OTP");
      }
      const data = await res.json();
      return { ok: true, sessionJwt: data.sessionJwt };
    }

    const resp = await descope.otp.verify.sms(formattedPhone, code);
    if (!resp.ok) {
      throw new Error(resp.error?.errorDescription || resp.error?.errorMessage || "Invalid or expired verification code");
    }

    return { ok: true, sessionJwt: resp.data?.sessionJwt };
  } catch (err: any) {
    console.error("Descope verify SMS error:", err);
    return {
      ok: false,
      message: err.message || "Invalid OTP code. Please check and try again.",
    };
  }
}
