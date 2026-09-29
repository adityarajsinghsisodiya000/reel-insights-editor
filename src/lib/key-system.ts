import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "./firebase-config";
import { getOrCreateDeviceId, generateDeviceFingerprint } from "./device-fingerprint";

const KEYS_COLLECTION = "keys";
const LOGS_COLLECTION = "logs";

export interface KeyData {
  id?: string;
  key: string;
  status: "active" | "inactive" | "deactivated" | "expired";
  duration: "1h" | "5h" | "12h" | "1d" | "7d" | "30d" | "lifetime";
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  activatedAt: Timestamp | null;
  deviceFingerprint: string | null;
  localStorageId: string | null;
  deviceInfo: {
    userAgent: string;
    screen: string;
    platform: string;
  } | null;
  assignedTo: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  keyData?: KeyData;
}

function getExpiryFromDuration(duration: string): Date | null {
  const now = new Date();
  switch (duration) {
    case "1h": return new Date(now.getTime() + 1 * 60 * 60 * 1000);
    case "5h": return new Date(now.getTime() + 5 * 60 * 60 * 1000);
    case "12h": return new Date(now.getTime() + 12 * 60 * 60 * 1000);
    case "1d": return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "lifetime": return null;
    default: return null;
  }
}

export async function validateAndActivateKey(inputKey: Promise<string>): Promise<ValidationResult> {
  try {
    const key = await inputKey;
    const normalizedKey = key.trim().toUpperCase();

    const q = query(collection(getDb(), KEYS_COLLECTION), where("key", "==", normalizedKey));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { valid: false, error: "Invalid key" };
    }

    const keyDoc = snapshot.docs[0];
    const keyData = { id: keyDoc.id, ...keyDoc.data() } as KeyData;

    if (keyData.status === "deactivated") {
      await logAction(normalizedKey, "rejected_deactivated");
      return { valid: false, error: "Key has been deactivated. Contact @Diablothedemon on Telegram" };
    }

    if (keyData.status === "expired" || (keyData.expiresAt && keyData.expiresAt.toDate() < new Date())) {
      if (keyData.status !== "expired") {
        await updateDoc(doc(getDb(), KEYS_COLLECTION, keyDoc.id), { status: "expired" });
      }
      await logAction(normalizedKey, "rejected_expired");
      return { valid: false, error: "Key has expired. Contact @Diablothedemon on Telegram for renewal" };
    }

    const deviceId = await getOrCreateDeviceId();
    const fingerprint = await generateDeviceFingerprint();

    // First time activation — key was inactive, now activate and start timer
    if (keyData.status === "inactive") {
      const expiry = getExpiryFromDuration(keyData.duration);
      await updateDoc(doc(getDb(), KEYS_COLLECTION, keyDoc.id), {
        status: "active",
        expiresAt: expiry ? Timestamp.fromDate(expiry) : null,
        activatedAt: serverTimestamp(),
        deviceFingerprint: fingerprint,
        localStorageId: deviceId,
        deviceInfo: {
          userAgent: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`,
          platform: navigator.platform,
        },
      });
      await logAction(normalizedKey, "activated");
      const updatedData = { ...keyData, status: "active" as const, expiresAt: expiry ? Timestamp.fromDate(expiry) : null };
      return { valid: true, keyData: updatedData };
    }

    if (!keyData.deviceFingerprint) {
      const expiry = getExpiryFromDuration(keyData.duration);
      await updateDoc(doc(getDb(), KEYS_COLLECTION, keyDoc.id), {
        deviceFingerprint: fingerprint,
        localStorageId: deviceId,
        activatedAt: serverTimestamp(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`,
          platform: navigator.platform,
        },
      });
      await logAction(normalizedKey, "activated");
      return { valid: true, keyData };
    }

    if (keyData.deviceFingerprint === fingerprint || keyData.localStorageId === deviceId) {
      await logAction(normalizedKey, "verified");
      return { valid: true, keyData };
    }

    await logAction(normalizedKey, "rejected_bound");
    return {
      valid: false,
      error: "Key is already bound to another device. Contact @Diablothedemon on Telegram",
    };
  } catch (err) {
    console.error("Key validation error:", err);
    return { valid: false, error: "Network error. Please try again." };
  }
}

async function logAction(key: string, action: string) {
  try {
    await addDoc(collection(getDb(), LOGS_COLLECTION), {
      key,
      action,
      timestamp: serverTimestamp(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
    });
  } catch (err) {
    console.error("Log error:", err);
  }
}

export function isKeyStillActive(keyData: KeyData): boolean {
  if (keyData.status === "deactivated" || keyData.status === "expired") return false;
  if (keyData.status === "inactive") return true;
  if (keyData.duration === "lifetime") return true;
  if (!keyData.expiresAt) return true;
  return keyData.expiresAt.toDate() > new Date();
}
