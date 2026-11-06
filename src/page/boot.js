import(chrome.runtime.getURL("src/page/main.js"))
  .then((mod) => mod.start())
  .catch((error) => {
    console.error("[dateline] failed to start", error);
  });
