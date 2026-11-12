const crypto = require("node:crypto");

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "kp_access";
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || "kp_csrf";

function isSecureCookie() {
  if (process.env.COOKIE_SECURE !== undefined) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

function sameSiteValue() {
  const configured = String(process.env.COOKIE_SAME_SITE || "").trim();
  if (["Lax", "Strict", "None"].includes(configured)) return configured;
  return isSecureCookie() ? "None" : "Lax";
}

function cookieBase({ httpOnly = false, maxAgeSeconds } = {}) {
  const attributes = ["Path=/", `SameSite=${sameSiteValue()}`];
  if (httpOnly) attributes.push("HttpOnly");
  if (isSecureCookie()) attributes.push("Secure");
  if (process.env.COOKIE_DOMAIN) attributes.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  if (Number.isFinite(maxAgeSeconds)) attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  return attributes.join("; ");
}

function parseDurationSeconds(value, fallback = 12 * 60 * 60) {
  if (!value) return fallback;
  if (Number.isFinite(Number(value))) return Math.max(1, Number(value));
  const match = String(value).trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return fallback;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * multipliers[match[2].toLowerCase()];
}

function setCsrfCookie(res) {
  const csrf = crypto.randomBytes(32).toString("base64url");
  res.append("Set-Cookie", `${CSRF_COOKIE}=${encodeURIComponent(csrf)}; ${cookieBase({ maxAgeSeconds: parseDurationSeconds(process.env.JWT_EXPIRES_IN, 12 * 60 * 60) })}`);
  return csrf;
}

function setSessionCookies(res, jwt) {
  const maxAgeSeconds = parseDurationSeconds(process.env.JWT_EXPIRES_IN, 12 * 60 * 60);
  res.append("Set-Cookie", `${AUTH_COOKIE}=${encodeURIComponent(jwt)}; ${cookieBase({ httpOnly: true, maxAgeSeconds })}`);
  return setCsrfCookie(res);
}

function clearSessionCookies(res) {
  res.append("Set-Cookie", `${AUTH_COOKIE}=; ${cookieBase({ httpOnly: true, maxAgeSeconds: 0 })}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.append("Set-Cookie", `${CSRF_COOKIE}=; ${cookieBase({ maxAgeSeconds: 0 })}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return null; }
  }
  return null;
}

function csrfMatches(req) {
  const cookieToken = getCookie(req, CSRF_COOKIE);
  const headerToken = req.get("x-csrf-token");
  if (!cookieToken || typeof headerToken !== "string") return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { AUTH_COOKIE, CSRF_COOKIE, setSessionCookies, setCsrfCookie, clearSessionCookies, getCookie, csrfMatches, parseDurationSeconds };
