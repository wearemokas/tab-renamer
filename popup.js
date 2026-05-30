const newNameInput   = document.getElementById('newName');
const renameBtn      = document.getElementById('renameBtn');
const resetBtn       = document.getElementById('resetBtn');
const currentTitleEl = document.getElementById('currentTitle');
const dot            = document.getElementById('dot');
const statusEl       = document.getElementById('status');
const savedListEl    = document.getElementById('savedList');
const savedCount     = document.getElementById('savedCount');
const lockRow        = document.getElementById('lockRow');
const lockToggle     = document.getElementById('lockToggle');
const lockIcon       = document.getElementById('lockIcon');
const lockBox        = document.getElementById('lockBox');

let currentTab  = null;
let statusTimer = null;

/* ── utils ── */
function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status visible ' + (isError ? 'err' : 'ok');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('visible'), 2400);
}

function storageKey(url) {
  try { const u = new URL(url); return 'rename_' + u.origin + u.pathname; }
  catch { return 'rename_' + url; }
}
function lockKey(url) {
  try { const u = new URL(url); return 'lock_' + u.origin + u.pathname; }
  catch { return 'lock_' + url; }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── apply title directly via scripting API (always works) ── */
async function applyTitle(tabId, title) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (t) => { document.title = t; },
      args: [title]
    });
  } catch (_) {
    // fallback: try sendMessage
    try { await chrome.tabs.sendMessage(tabId, { action: 'rename', title }); } catch (_) {}
  }
}

async function resetTitle(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // restore from data attribute if we saved it, else reload location
        const orig = document.head.dataset.origTitle;
        if (orig !== undefined) document.title = orig;
      }
    });
  } catch (_) {
    try { await chrome.tabs.sendMessage(tabId, { action: 'reset' }); } catch (_) {}
  }
}

/* ── load tab ── */
async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentTitleEl.textContent = tab.title || '(senza titolo)';
}

/* ── lock ── */
async function loadLockState() {
  if (!currentTab) return;
  const sk   = storageKey(currentTab.url);
  const data = await chrome.storage.local.get(sk);
  const isRenamed = !!data[sk];

  dot.classList.toggle('on', isRenamed);
  lockRow.style.display = isRenamed ? 'flex' : 'none';
  if (!isRenamed) return;

  const lk       = lockKey(currentTab.url);
  const lockData = await chrome.storage.local.get(lk);
  const locked   = lockData[lk] === true;
  lockToggle.checked = locked;
  lockIcon.textContent = locked ? '🔒' : '🔓';
  lockBox.classList.toggle('on', locked);
}

lockToggle.addEventListener('change', async () => {
  if (!currentTab) return;
  const locked = lockToggle.checked;
  await chrome.storage.local.set({ [lockKey(currentTab.url)]: locked });
  lockIcon.textContent = locked ? '🔒' : '🔓';
  lockBox.classList.toggle('on', locked);
  try { await chrome.tabs.sendMessage(currentTab.id, { action: 'setLock', locked }); } catch (_) {}
  showStatus(locked ? 'Titolo bloccato' : 'Titolo libero');
});

/* ── saved list ── */
async function loadSavedList() {
  const all     = await chrome.storage.local.get(null);
  const entries = Object.entries(all).filter(([k]) => k.startsWith('rename_'));
  savedCount.textContent = entries.length;

  if (!entries.length) {
    savedListEl.innerHTML = '<div class="empty">Nessuna tab rinominata</div>';
    return;
  }

  savedListEl.innerHTML = entries.map(([key, d]) => `
    <div class="item">
      <div class="item-left">
        <div class="item-name">${escapeHtml(d.name)}</div>
        <div class="item-url">${escapeHtml(d.url)}</div>
      </div>
      <button class="xbtn" data-key="${key}" title="Rimuovi">✕</button>
    </div>
  `).join('');

  savedListEl.querySelectorAll('.xbtn').forEach(btn =>
    btn.addEventListener('click', async () => {
      await chrome.storage.local.remove(btn.dataset.key);
      await loadSavedList();
      await loadLockState();
      showStatus('Rimossa');
    })
  );
}

/* ── rename ── */
renameBtn.addEventListener('click', async () => {
  const name = newNameInput.value.trim();
  if (!name) { showStatus('Inserisci un nome', true); return; }
  if (!currentTab) return;

  const sk = storageKey(currentTab.url);
  await chrome.storage.local.set({ [sk]: { name, url: currentTab.url } });

  await applyTitle(currentTab.id, name);

  currentTitleEl.textContent = name;
  newNameInput.value = '';
  showStatus('✓ Rinominata!');
  await loadSavedList();
  await loadLockState();
});

/* ── reset ── */
resetBtn.addEventListener('click', async () => {
  if (!currentTab) return;
  const sk = storageKey(currentTab.url);
  const lk = lockKey(currentTab.url);
  await chrome.storage.local.remove([sk, lk]);
  await resetTitle(currentTab.id);
  showStatus('Titolo ripristinato');
  // wait a tick then reload title from tab
  setTimeout(async () => {
    await loadCurrentTab();
    await loadSavedList();
    await loadLockState();
  }, 150);
});

newNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') renameBtn.click(); });

/* ── init ── */
(async () => {
  await loadCurrentTab();
  await loadSavedList();
  await loadLockState();

  if (currentTab) {
    const sk   = storageKey(currentTab.url);
    const data = await chrome.storage.local.get(sk);
    if (data[sk]) newNameInput.value = data[sk].name;
  }
})();
