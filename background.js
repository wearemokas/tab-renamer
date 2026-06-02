// Auto-apply saved renames when a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const u          = new URL(tab.url);
    const renameKey  = 'rename_' + u.origin + u.pathname;
    const lockKey    = 'lock_'   + u.origin + u.pathname;

    chrome.storage.local.get([renameKey, lockKey], (data) => {
      const entry  = data[renameKey];
      const locked = data[lockKey] === true;
      if (!entry) return;

      const name = entry.name;

      // Inject title directly — no sendMessage, no connection errors
      chrome.scripting.executeScript({
        target: { tabId },
        func: (title, isLocked) => {
          // save original for reset
          if (!document.head.dataset._origTitle) {
            document.head.dataset._origTitle = document.title;
          }
          document.title = title;

          // if locked, keep enforcing against dynamic changes
          if (isLocked) {
            const target = document.querySelector('title') ?? document.head;
            new MutationObserver(() => {
              if (document.title !== title) document.title = title;
            }).observe(target, { subtree: true, characterData: true, childList: true });
          }
        },
        args: [name, locked]
      }).catch(() => {}); // silently ignore restricted pages
    });

  } catch (_) {}
});
