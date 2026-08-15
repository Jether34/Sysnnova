export type AuthState = "loading" | "unauthenticated" | "authenticated" | "device_conflict";

export interface User {
  id: string;
  role: "adviser" | "teacher" | "student" | "admin";
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  gender?: string;
  grade?: string;
  strand?: string;
  tvlStrand?: string;
  specialization?: string;
  section?: string;
  schoolId?: string;
  school?: object;
  subject?: string;
  semester?: string;
  academicYear?: string;
  advisories?: any[];
  teachingLoad?: any[];
  publicKey?: string;
  privateKey?: string;
  createdAt?: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
}

export interface LoginResult {
  user: User;
  token: string;
  refresh: string;
  sessionId: string;
  needsVerification?: boolean;
  maskedEmail?: string;
}

export interface DeviceConflictError {
  code: "ACCOUNT_ALREADY_LINKED";
  message: string;
}
