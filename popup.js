const newNameInput   = document.getElementById('newName');
const renameBtn      = document.getElementById('renameBtn');
const resetBtn       = document.getElementById('resetBtn');
const currentTitleEl = document.getElementById('currentTitle');
const currentDot     = document.getElementById('currentDot');
const statusEl       = document.getElementById('status');
const savedListEl    = document.getElementById('savedList');
const savedCount     = document.getElementById('savedCount');
const lockRow        = document.getElementById('lockRow');
const lockToggle     = document.getElementById('lockToggle');
const lockIcon       = document.getElementById('lockIcon');
const lockIconWrap   = document.getElementById('lockIconWrap');

let currentTab  = null;
let statusTimer = null;

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status visible ' + (isError ? 'err' : 'ok');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('visible'), 2200);
}

function getStorageKey(url) {
  try {
    const u = new URL(url);
    return 'rename_' + u.origin + u.pathname;
  } catch {
    return 'rename_' + url;
  }
}

function getLockKey(url) {
  return 'lock_' + getStorageKey(url).replace('rename_', '');
}

async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentTitleEl.textContent = tab.title || '(senza titolo)';
  currentTitleEl.title = tab.title || '';
}

function setDot(isRenamed) {
  currentDot.classList.toggle('renamed', isRenamed);
}

async function loadLockState() {
  if (!currentTab) return;
  const key   = getStorageKey(currentTab.url);
  const saved = await chrome.storage.local.get(key);
  const isRenamed = !!saved[key];

  setDot(isRenamed);
  lockRow.style.display = isRenamed ? 'flex' : 'none';
  if (!isRenamed) return;

  const lk       = getLockKey(currentTab.url);
  const lockData = await chrome.storage.local.get(lk);
  const locked   = lockData[lk] === true;
  lockToggle.checked = locked;
  lockIcon.textContent = locked ? '🔒' : '🔓';
  lockIconWrap.classList.toggle('active', locked);
}

lockToggle.addEventListener('change', async () => {
  if (!currentTab) return;
  const lk     = getLockKey(currentTab.url);
  const locked = lockToggle.checked;
  await chrome.storage.local.set({ [lk]: locked });
  lockIcon.textContent = locked ? '🔒' : '🔓';
  lockIconWrap.classList.toggle('active', locked);
  await chrome.tabs.sendMessage(currentTab.id, { action: 'setLock', locked });
  showStatus(locked ? 'Titolo bloccato' : 'Titolo libero');
});

async function loadSavedList() {
  const all     = await chrome.storage.local.get(null);
  const entries = Object.entries(all).filter(([k]) => k.startsWith('rename_'));

  savedCount.textContent = entries.length;

  if (entries.length === 0) {
    savedListEl.innerHTML = '<div class="empty-state">Nessuna tab rinominata</div>';
    return;
  }

  savedListEl.innerHTML = entries.map(([key, data]) => `
    <div class="saved-item">
      <div class="saved-item-left">
        <div class="saved-item-name">${escapeHtml(data.name)}</div>
        <div class="saved-item-url">${escapeHtml(data.url)}</div>
      </div>
      <button class="del-btn" data-key="${key}" title="Rimuovi">✕</button>
    </div>
  `).join('');

  savedListEl.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.storage.local.remove(btn.dataset.key);
      await loadSavedList();
      await loadLockState();
      showStatus('Rimossa');
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

renameBtn.addEventListener('click', async () => {
  const name = newNameInput.value.trim();
  if (!name) { showStatus('Inserisci un nome', true); return; }
  if (!currentTab) return;

  const key = getStorageKey(currentTab.url);
  await chrome.storage.local.set({ [key]: { name, url: currentTab.url } });
  await chrome.tabs.sendMessage(currentTab.id, { action: 'rename', title: name });

  currentTitleEl.textContent = name;
  newNameInput.value = '';
  showStatus('✓ Rinominata!');
  await loadSavedList();
  await loadLockState();
});

resetBtn.addEventListener('click', async () => {
  if (!currentTab) return;
  const key = getStorageKey(currentTab.url);
  const lk  = getLockKey(currentTab.url);
  await chrome.storage.local.remove([key, lk]);
  await chrome.tabs.sendMessage(currentTab.id, { action: 'reset' });
  showStatus('Titolo ripristinato');
  await loadCurrentTab();
  await loadSavedList();
  await loadLockState();
});

newNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') renameBtn.click();
});

(async () => {
  await loadCurrentTab();
  await loadSavedList();
  await loadLockState();

  if (currentTab) {
    const key  = getStorageKey(currentTab.url);
    const data = await chrome.storage.local.get(key);
    if (data[key]) newNameInput.value = data[key].name;
  }
})();
