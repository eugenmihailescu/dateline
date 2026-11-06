if (globalThis.__datelineHook) return;
globalThis.__datelineHook = true;

const PAGE = "dateline-page";
const EXT = "dateline-ext";
const BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const origFetch = globalThis.fetch;
const buffer = [];
let authorization = "";
let aboutRequest = null;
let discoverPromise = null;

function headerValue(headers, name) {
  if (!headers) return "";
  const lower = name.toLowerCase();
  if (typeof headers.get === "function") return headers.get(name) || headers.get(lower) || "";
  if (Array.isArray(headers)) {
    const row = headers.find((item) => String(item?.[0] || "").toLowerCase() === lower);
    return row ? String(row[1]) : "";
  }
  if (typeof headers === "object") {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === lower) return String(headers[key]);
    }
  }
  return "";
}

function cookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return "";
}

function post(message) {
  window.postMessage({ source: PAGE, ...message }, location.origin);
}

function remember(message) {
  if (message.type === "passive" && message.users?.length) {
    buffer.push(message);
    if (buffer.length > 40) buffer.shift();
  }
  post(message);
}

function captureAbout(url) {
  try {
    const parsed = new URL(url, location.origin);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.at(-1) !== "AboutAccountQuery" || !parts.at(-2)) return;
    parsed.searchParams.delete("variables");
    aboutRequest = { queryId: parts.at(-2), extra: parsed.searchParams.toString() };
  } catch {
    /* A malformed URL does not stop the page request. */
  }
}

function noteRequest(input, init) {
  const url = requestUrl(input);
  if (!url.includes("/i/api/graphql/")) return;
  const headers = init?.headers || input?.headers;
  const auth = headerValue(headers, "authorization");
  if (auth) authorization = auth;
  if (url.includes("AboutAccountQuery")) captureAbout(url);
}

function noteResponse(input, init, response) {
  const url = requestUrl(input);
  if (!url.includes("/i/api/graphql/") || !response?.ok) return;
  if (headerValue(init?.headers, "x-dateline") === "1") return;
  if (url.includes("AboutAccountQuery")) captureAbout(url);
  response
    .clone()
    .json()
    .then((data) => {
      const users = extractSignals(data);
      if (users.length) remember({ type: "passive", users });
    })
    .catch(() => {});
}

if (typeof origFetch === "function") {
  window.fetch = function datelineFetch(input, init) {
    try {
      noteRequest(input, init);
    } catch {
      /* Keep the page request alive. */
    }
    return origFetch.apply(this, arguments).then((response) => {
      try {
        noteResponse(input, init, response);
      } catch {
        /* Inspection must not change the response. */
      }
      return response;
    });
  };
}

const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function datelineOpen(method, url, ...rest) {
  this.__datelineUrl = url;
  return originalOpen.call(this, method, url, ...rest);
};
XMLHttpRequest.prototype.send = function datelineSend(body) {
  this.addEventListener("load", () => {
    try {
      const url = String(this.__datelineUrl || "");
      if (!url.includes("/i/api/graphql/")) return;
      if (url.includes("AboutAccountQuery")) captureAbout(url);
      const users = extractSignals(JSON.parse(this.responseText));
      if (users.length) remember({ type: "passive", users });
    } catch {
      /* Non-JSON responses are ignored. */
    }
  });
  return originalSend.call(this, body);
};

const originalPush = history.pushState;
const originalReplace = history.replaceState;
history.pushState = function datelinePush(...args) {
  const result = originalPush.apply(this, args);
  post({ type: "navigate" });
  return result;
};
history.replaceState = function datelineReplace(...args) {
  const result = originalReplace.apply(this, args);
  post({ type: "navigate" });
  return result;
};
window.addEventListener("popstate", () => post({ type: "navigate" }));

function scriptUrls() {
  const urls = new Set();
  for (const script of document.scripts) {
    if (script.src) urls.add(script.src);
  }
  for (const entry of performance.getEntriesByType("resource")) {
    if (typeof entry.name === "string" && entry.name.includes(".js")) urls.add(entry.name);
  }
  return [...urls].sort((left, right) => rank(left) - rank(right));
}

function rank(url) {
  if (url.includes("/main.")) return 0;
  if (url.includes("client-web")) return 1;
  if (url.includes("bundle")) return 2;
  return 3;
}

async function findQueryId() {
  const patterns = [
    /queryId:"([A-Za-z0-9_-]{8,})",operationName:"AboutAccountQuery"/,
    /operationName:"AboutAccountQuery"[\s\S]{0,160}?queryId:"([A-Za-z0-9_-]{8,})"/,
  ];
  for (const url of scriptUrls().slice(0, 12)) {
    if (!url.startsWith("https:")) continue;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await origFetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const text = await response.text();
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
      }
    } catch {
      /* Try the next bundle. */
    }
  }
  return "";
}

async function discoverQueryId() {
  if (aboutRequest?.queryId) return aboutRequest.queryId;
  if (!discoverPromise) discoverPromise = findQueryId();
  const id = await discoverPromise;
  if (!id) discoverPromise = null;
  return id;
}

async function enrich(handle) {
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return { ok: false, reason: "bad_handle" };
  const csrf = cookie("ct0");
  if (!csrf) return { ok: false, reason: "logged_out" };
  const queryId = await discoverQueryId();
  if (!queryId) return { ok: false, reason: "no_query" };
  const variables = encodeURIComponent(JSON.stringify({ screenName: handle }));
  let url = `${location.origin}/i/api/graphql/${queryId}/AboutAccountQuery?variables=${variables}`;
  if (aboutRequest?.extra) url += `&${aboutRequest.extra}`;
  const response = await origFetch(url, {
    credentials: "include",
    headers: {
      authorization: authorization || BEARER,
      "x-csrf-token": csrf,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      accept: "application/json",
      "x-dateline": "1",
    },
  });
  if (response.status === 429) {
    return { ok: false, reason: "rate_limit", reset: Number(response.headers.get("x-rate-limit-reset") || 0) };
  }
  if (response.status === 400 || response.status === 404) {
    aboutRequest = null;
    discoverPromise = null;
    return { ok: false, reason: "bad_query", status: response.status };
  }
  if (!response.ok) return { ok: false, reason: "http", status: response.status };
  const data = await response.json();
  const users = extractSignals(data);
  const user = users.find((item) => item.handle.toLowerCase() === handle.toLowerCase()) || users[0];
  return {
    ok: true,
    handle,
    accountBasedIn: user?.accountBasedIn || findAccountBasedIn(data),
    statedLocation: user?.statedLocation || "",
    lang: user?.lang || "",
    websiteHost: user?.websiteHost || "",
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.source !== EXT) return;
  if (data.type === "hello") {
    for (const message of buffer) post(message);
    post({ type: "hello-ack" });
    return;
  }
  if (data.type === "enrich" && data.handle) {
    enrich(String(data.handle)).then(
      (result) => post({ type: "enrich-result", requestId: data.requestId, ...result }),
      () => post({ type: "enrich-result", requestId: data.requestId, ok: false, reason: "http" }),
    );
  }
});
