// Nexus Social — UI Utilities

function toast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: '✦' };
  t.innerHTML = `<span>${icons[type] || '✦'}</span>${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openModal(html) {
  const m = document.getElementById('modal');
  const o = document.getElementById('modalOverlay');
  m.innerHTML = html;
  m.classList.add('open');
  o.classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('modalOverlay').classList.remove('open');
}

function confirmLogout() {
  openModal(`
    <div class="modal-title">Sign Out <span class="modal-close" onclick="closeModal()">×</span></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:20px;">Are you sure you want to sign out of Nexus Social?</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="window.location='/logout'" style="flex:1;">Sign Out</button>
    </div>
  `);
}

function gradientForString(str) {
  const gradients = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString();
}

function renderAvatar(user, size = 38, radius = 11) {
  const g = gradientForString(user.username || 'u');
  const initial = (user.full_name || user.username || 'U')[0].toUpperCase();
  const style = `width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${Math.floor(size*0.37)}px;`;
  if (user.avatar_url) {
    return `<div class="user-av ${g}" style="${style}"><img src="${user.avatar_url}" alt="${initial}"/></div>`;
  }
  return `<div class="user-av ${g}" style="${style}">${initial}</div>`;
}

// Search
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimeout;

searchInput && searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (!q) { searchResults.classList.remove('open'); return; }
  searchTimeout = setTimeout(async () => {
    try {
      const data = await API.get(`/api/users/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data);
    } catch(e) {}
  }, 300);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) {
    searchResults.classList.remove('open');
  }
});

function renderSearchResults(data) {
  const { users, groups } = data;
  if (!users.length && !groups.length) {
    searchResults.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text3);font-size:12px;">No results found</div>';
    searchResults.classList.add('open');
    return;
  }
  let html = '';
  users.forEach(u => {
    const g = gradientForString(u.username);
    html += `<div class="sr-item" onclick="viewProfile('${u.id}')">
      <div class="sr-av ${g}">${(u.full_name||'U')[0]}</div>
      <div>
        <div class="sr-name">${u.full_name}</div>
        <div class="sr-sub">@${u.username} · #${u.nexus_id}</div>
      </div>
    </div>`;
  });
  groups.forEach(g => {
    html += `<div class="sr-item" onclick="viewGroup('${g.id}')">
      <div class="sr-av g4">${g.banner_emoji || '👥'}</div>
      <div>
        <div class="sr-name">${g.name}</div>
        <div class="sr-sub">Group · ${g.group_code} · ${g.member_count} members</div>
      </div>
    </div>`;
  });
  searchResults.innerHTML = html;
  searchResults.classList.add('open');
}

function viewProfile(userId) {
  searchResults.classList.remove('open');
  searchInput.value = '';
  // Load profile in modal
  loadProfileModal(userId);
}

async function loadProfileModal(userId) {
  try {
    const u = await API.get(`/api/users/profile/${userId}`);
    const g = gradientForString(u.username || 'u');
    const initial = (u.full_name || 'U')[0];
    openModal(`
      <div class="modal-title">${u.full_name} <span class="modal-close" onclick="closeModal()">×</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0 16px;">
        <div class="user-av ${g}" style="width:64px;height:64px;border-radius:16px;font-size:24px;">${u.avatar_url ? `<img src="${u.avatar_url}"/>` : initial}</div>
        <div style="text-align:center;">
          <div style="font-family:'Syne';font-weight:700;font-size:16px;">${u.full_name}</div>
          <div style="color:var(--text2);font-size:12px;">@${u.username} · <span class="uid-tag">#${u.nexus_id}</span></div>
          <div style="margin-top:6px;font-size:12px;color:var(--text2);">${u.bio || ''}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
          <div style="background:var(--panel2);border:1px solid var(--border2);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--text2);">${u.pronouns || ''}</div>
          ${u.country ? `<div style="font-size:20px;">${countryFlag(u.country)}</div>` : ''}
        </div>
        <div style="display:flex;gap:10px;width:100%;margin-top:8px;">
          <button class="btn btn-primary" style="flex:1;" onclick="sendFriendReq('${u.id}')">Add Friend ✦</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="openDm('${u.id}','${u.username}')">Message</button>
          <button class="btn btn-danger" style="padding:8px 10px;" onclick="reportUser('${u.id}')">🚨</button>
        </div>
      </div>
    `);
  } catch(e) { toast('Could not load profile', 'error'); }
}

function countryFlag(code) {
  if (!code) return '';
  const flags = { MU:'🇲🇺',US:'🇺🇸',GB:'🇬🇧',FR:'🇫🇷',BR:'🇧🇷',IN:'🇮🇳',AU:'🇦🇺',CA:'🇨🇦',DE:'🇩🇪',JP:'🇯🇵',KR:'🇰🇷',IT:'🇮🇹',ZA:'🇿🇦',NG:'🇳🇬',GH:'🇬🇭' };
  return flags[code] || '🌍';
}

async function sendFriendReq(receiverId) {
  try {
    await API.post('/api/friends/request', { receiver_id: receiverId });
    toast('Friend request sent! ✦', 'success');
    closeModal();
  } catch(e) { toast(e.message, 'error'); }
}

async function reportUser(userId) {
  openModal(`
    <div class="modal-title">Report User <span class="modal-close" onclick="closeModal()">×</span></div>
    <div class="fg" style="margin-bottom:12px;">
      <label class="fl">Reason</label>
      <select class="fi" id="reportType">
        <option value="harassment">Harassment</option>
        <option value="spam">Spam / Bot</option>
        <option value="inappropriate_content">Inappropriate Content</option>
        <option value="hate_speech">Hate Speech</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="fg" style="margin-bottom:16px;">
      <label class="fl">Details (optional)</label>
      <textarea class="fi" id="reportMsg" placeholder="Describe what happened..." style="height:80px;resize:none;"></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="submitReport('${userId}')" style="flex:1;">Submit Report</button>
    </div>
  `);
}

async function submitReport(userId) {
  const type = document.getElementById('reportType').value;
  const msg = document.getElementById('reportMsg').value;
  try {
    await API.post('/api/reports/submit', { reported_user_id: userId, type, message: msg });
    toast('Report submitted', 'success');
    closeModal();
  } catch(e) { toast('Could not submit report', 'error'); }
}

function viewGroup(groupId) {
  searchResults.classList.remove('open');
  searchInput.value = '';
  goTo('groups');
}
