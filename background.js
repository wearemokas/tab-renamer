// Re-apply saved tab names (and lock state) when a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const u = new URL(tab.url);
    const base     = u.origin + u.pathname;
    const renameKey = 'rename_' + base;
    const lockKey   = 'lock_' + base;

    chrome.storage.local.get([renameKey, lockKey], (data) => {
      if (data[renameKey]) {
        chrome.tabs.sendMessage(tabId, {
          action: 'rename',
          title:  data[renameKey].name,
        }).catch(() => {});

        // Send lock state right after
        chrome.tabs.sendMessage(tabId, {
          action: 'setLock',
          locked: data[lockKey] === true,
        }).catch(() => {});
      }
    });
  } catch {}
});
