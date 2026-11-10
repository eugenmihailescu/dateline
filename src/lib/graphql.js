function screenNameOf(user) {
  if (!user || typeof user !== "object") return "";
  const name = user.core?.screen_name || user.legacy?.screen_name || user.screen_name || "";
  return typeof name === "string" ? name.replace(/^@/, "").trim() : "";
}

function textField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function websiteHostOf(user) {
  const urls = user?.legacy?.entities?.url?.urls;
  const expanded = Array.isArray(urls) ? urls.find((item) => item?.expanded_url)?.expanded_url : "";
  const raw = textField(expanded) || textField(user?.legacy?.url);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function aboutFields(about) {
  if (!about || typeof about !== "object") return { accountBasedIn: "", connectedVia: "" };
  return {
    accountBasedIn: textField(about.account_based_in || about.accountBasedIn),
    connectedVia: textField(about.source),
  };
}

function blankUser(handle) {
  return {
    handle,
    accountBasedIn: "",
    statedLocation: "",
    connectedVia: "",
    lang: "",
    websiteHost: "",
  };
}

function absorbUser(found, user) {
  const handle = screenNameOf(user);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return;
  const key = handle.toLowerCase();
  const prev = found.get(key) || blankUser(handle);
  const about = aboutFields(user.about_profile);
  const stated = textField(user.legacy?.location);
  const lang = textField(user.legacy?.lang).toLowerCase();
  const websiteHost = websiteHostOf(user);
  if (about.accountBasedIn) prev.accountBasedIn = about.accountBasedIn;
  if (about.connectedVia) prev.connectedVia = about.connectedVia;
  if (stated) prev.statedLocation = stated;
  if (lang) prev.lang = lang;
  if (websiteHost) prev.websiteHost = websiteHost;
  prev.handle = handle;
  found.set(key, prev);
}

function extractSignals(payload) {
  const found = new Map();
  let seen = 0;

  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 14 || seen > 100000) return;
    seen += 1;
    if (screenNameOf(node)) absorbUser(found, node);
    const children = Array.isArray(node) ? node : Object.values(node);
    for (const child of children) {
      if (child && typeof child === "object") walk(child, depth + 1);
    }
  }

  walk(payload, 0);
  return [...found.values()].filter(
    (user) => user.accountBasedIn || user.statedLocation || user.connectedVia || user.lang || user.websiteHost,
  );
}

function findAccountBasedIn(payload) {
  let found = "";
  let seen = 0;

  function walk(node, depth) {
    if (found || !node || typeof node !== "object" || depth > 14 || seen > 100000) return;
    seen += 1;
    const value = textField(node.account_based_in || node.accountBasedIn);
    if (value) {
      found = value;
      return;
    }
    const children = Array.isArray(node) ? node : Object.values(node);
    for (const child of children) {
      if (child && typeof child === "object") walk(child, depth + 1);
    }
  }

  walk(payload, 0);
  return found;
}

function findAboutSource(payload) {
  let found = "";
  let seen = 0;

  function walk(node, depth) {
    if (found || !node || typeof node !== "object" || depth > 14 || seen > 100000) return;
    seen += 1;
    const value = aboutFields(node.about_profile).connectedVia;
    if (value) {
      found = value;
      return;
    }
    const children = Array.isArray(node) ? node : Object.values(node);
    for (const child of children) {
      if (child && typeof child === "object") walk(child, depth + 1);
    }
  }

  walk(payload, 0);
  return found;
}

export { extractSignals, findAccountBasedIn, findAboutSource };
