import { loadState, saveState } from "../lib/storage.js";

const enabled = document.querySelector("#enabled");
const stats = document.querySelector("#stats");
const note = document.querySelector("#note");

const state = await loadState();
enabled.checked = state.enabled;

enabled.addEventListener("change", async () => {
  await saveState({ ...state, enabled: enabled.checked });
  await refresh();
});

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const counts = await chrome.tabs.sendMessage(tab.id, { type: "dateline:stats" });
    if (!counts) return;
    stats.textContent = `${counts.scored} scored · ${counts.unresolved} unknown · ${counts.pending} waiting`;
    if (counts.loggedOut) note.textContent = "Log in to read About this account. Profile locations still work.";
    else if (counts.discoveryFailed) note.textContent = "About this account could not be read. Stated locations still work.";
    else note.textContent = "";
  } catch {
    stats.textContent = "This tab is not an x.com page, or Dateline is still starting.";
  }
}

refresh();
