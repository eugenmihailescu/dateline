import {
  handleFromHref,
  hostFromUrl,
  profileHandleFromPath,
  socialContextIsAd,
  statusIdFromHref,
} from "../lib/dom.js";

export const TWEET_SELECTORS = ['article[data-testid="tweet"]', 'article[role="article"]'];

export function timelineRoot(doc) {
  return (
    doc.querySelector('[data-testid="primaryColumn"]') ||
    doc.querySelector("main[role='main']") ||
    doc.querySelector("main") ||
    doc.body
  );
}

function ownNodes(element, selector) {
  return [...element.querySelectorAll(selector)].filter((node) => {
    const quote = node.closest('[data-testid="quoteTweet"]');
    return !quote || quote === element;
  });
}

export function readPost(element, selector) {
  const scope = ownNodes(element, '[data-testid="User-Name"]')[0] || element;
  let handle = null;
  for (const link of scope.querySelectorAll("a[href]")) {
    handle = handleFromHref(link.getAttribute("href"));
    if (handle) break;
  }
  if (!handle) {
    for (const link of ownNodes(element, "a[href]")) {
      handle = handleFromHref(link.getAttribute("href"));
      if (handle) break;
    }
  }
  const statusHref = ownNodes(element, 'a[href*="/status/"]')[0]?.getAttribute("href") || "";
  const statusId = statusIdFromHref(statusHref);
  if (!handle || !statusId) return null;
  const social = ownNodes(element, '[data-testid="socialContext"]')
    .map((node) => node.textContent || "")
    .join(" ");
  const promoted =
    Boolean(element.closest('[data-testid="placementTracking"]')) || socialContextIsAd(social);
  return { element, handle, statusId, promoted, selector };
}

export function collectPosts(root) {
  const scope = timelineRoot(root) || root;
  const posts = [];
  const seen = new Set();
  for (const selector of TWEET_SELECTORS) {
    for (const element of scope.querySelectorAll(selector)) {
      if (seen.has(element)) continue;
      if (!element.querySelector('a[href*="/status/"]')) continue;
      seen.add(element);
      const post = readPost(element, selector);
      if (post) posts.push(post);
    }
  }
  for (const element of scope.querySelectorAll('[data-testid="quoteTweet"]')) {
    if (seen.has(element) || element.querySelector("article")) continue;
    const post = readPost(element, '[data-testid="quoteTweet"]');
    if (post) posts.push(post);
  }
  return posts;
}

export function readProfile(doc) {
  const handle = profileHandleFromPath(doc.location.pathname);
  if (!handle) return null;
  const location = doc.querySelector('[data-testid="UserLocation"]');
  const link = doc.querySelector('[data-testid="UserUrl"] a');
  const header = doc.querySelector('[data-testid="UserName"]');
  if (!location && !link && !header) return null;
  return {
    handle,
    statedLocationRaw: location ? location.textContent.trim() : null,
    statedSeen: Boolean(location),
    websiteHost: link ? hostFromUrl(link.getAttribute("href")) : "",
  };
}
