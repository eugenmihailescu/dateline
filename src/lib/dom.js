export const RESERVED_HANDLES = new Set([
  "home",
  "explore",
  "search",
  "settings",
  "i",
  "messages",
  "notifications",
  "compose",
  "tos",
  "privacy",
  "login",
  "signup",
  "intent",
  "share",
  "hashtag",
  "jobs",
  "account",
  "about",
  "help",
  "download",
  "lists",
  "bookmarks",
  "communities",
  "premium",
  "verified",
  "followers",
  "following",
  "analytics",
]);

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export function handleFromPath(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  const handle = parts[0] || "";
  if (!HANDLE.test(handle) || RESERVED_HANDLES.has(handle.toLowerCase())) return null;
  return handle;
}

export function profileHandleFromPath(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  if (parts[1] === "status") return null;
  return handleFromPath(pathname);
}

export function handleFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://x.com");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    return handleFromPath(`/${parts[0]}`);
  } catch {
    return null;
  }
}

export function statusIdFromHref(href) {
  const match = String(href || "").match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function socialContextIsAd(text) {
  const value = String(text || "").trim();
  return value === "Ad" || /\bpromoted\b/i.test(value);
}

export function hostFromUrl(href) {
  if (!href) return "";
  try {
    return new URL(href, "https://x.com").hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}
