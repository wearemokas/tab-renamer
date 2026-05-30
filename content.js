function getStorageKey(url) {
  try {
    const u = new URL(url);
    return 'rename_' + u.origin + u.pathname;
  } catch {
    return 'rename_' + url;
  }
}

function getLockKey(url) {
  try {
    const u = new URL(url);
    return 'lock_' + u.origin + u.pathname;
  } catch {
    return 'lock_' + url;
  }
}

let locked = false;
let customTitle = null;
let originalTitle = document.title;

const renameKey = getStorageKey(location.href);
const lockKey   = getLockKey(location.href);

// Load saved state on page start
chrome.storage.local.get([renameKey, lockKey], (data) => {
  const entry = data[renameKey];
  locked      = data[lockKey] === true;
  if (entry) {
    customTitle = entry.name;
    document.title = customTitle;
  }
  startObserver();
});

function startObserver() {
  const titleEl = document.querySelector('title') || document.head;

  const observer = new MutationObserver(() => {
    if (!customTitle) return;           // no custom name set → leave page free
    if (!locked) return;                // lock off → let the page change the title
    if (document.title !== customTitle) {
      document.title = customTitle;     // lock on → enforce custom name
    }
  });

  observer.observe(titleEl, {
    subtree: true,
    characterData: true,
    childList: true,
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'rename') {
    originalTitle = document.title;
    customTitle   = msg.title;
    document.title = customTitle;

  } else if (msg.action === 'reset') {
    customTitle = null;
    locked      = false;
    document.title = originalTitle;

  } else if (msg.action === 'setLock') {
    locked = msg.locked;
    // If just locked, immediately enforce
    if (locked && customTitle && document.title !== customTitle) {
      document.title = customTitle;
    }
  }
});
