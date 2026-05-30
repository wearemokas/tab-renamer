function storageKey(url) {
  try { const u = new URL(url); return 'rename_' + u.origin + u.pathname; }
  catch { return 'rename_' + url; }
}
function lockKey(url) {
  try { const u = new URL(url); return 'lock_' + u.origin + u.pathname; }
  catch { return 'lock_' + url; }
}

const SK = storageKey(location.href);
const LK = lockKey(location.href);

let customTitle = null;
let locked      = false;
let originalTitle = document.title;

// Save original title on head for reset
if (!document.head.dataset._origTitle) {
  document.head.dataset._origTitle = document.title;
}

/* ── load saved state on start ── */
chrome.storage.local.get([SK, LK], (data) => {
  customTitle = data[SK]?.name ?? null;
  locked      = data[LK] === true;
  if (customTitle) document.title = customTitle;
  startObserver();
});

/* ── react to storage changes (set by popup) ── */
chrome.storage.onChanged.addListener((changes) => {
  if (changes[SK]) {
    const entry = changes[SK].newValue;
    if (entry) {
      customTitle = entry.name;
      document.title = customTitle;
    } else {
      // deleted → restore original
      customTitle = null;
      locked = false;
      document.title = document.head.dataset._origTitle || originalTitle;
    }
  }
  if (changes[LK]) {
    locked = changes[LK].newValue === true;
    if (locked && customTitle) document.title = customTitle;
  }
});

/* ── observer: enforce lock ── */
function startObserver() {
  const target = document.querySelector('title') ?? document.head;
  new MutationObserver(() => {
    if (!customTitle || !locked) return;
    if (document.title !== customTitle) document.title = customTitle;
  }).observe(target, { subtree: true, characterData: true, childList: true });
}
