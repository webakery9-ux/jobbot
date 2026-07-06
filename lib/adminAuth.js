import crypto from "crypto";

const COOKIE_NAME = "admin_token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function verifyPassword(password) {
  const expected = secret();
  if (!expected || !password) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createAdminToken() {
  const expiresAt = Date.now() + MAX_AGE_MS;
  const signature = sign(String(expiresAt));
  return `${expiresAt}.${signature}`;
}

export function verifyAdminToken(token) {
  if (!token) return false;
  const [expiresAtStr, signature] = token.split(".");
  if (!expiresAtStr || !signature) return false;
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) return false;
  const expected = sign(expiresAtStr);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isAdminRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE_SECONDS = MAX_AGE_MS / 1000;
