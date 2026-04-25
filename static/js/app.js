// Nexus Social — App Bootstrap
let sidebarCollapsed = false;

document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  goTo(CURRENT_PAGE, PROFILE_USER ? { profileUser: PROFILE_USER } : {});
  loadBadges();
  initSearch();
  // Restore sidebar state
  const saved = localStorage.getItem('sb_collapsed');
  if (saved === '1') collapseSidebar(true);
});

function goTo(page, opts = {}) {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="page-loading"><div class="spinner">✦</div></div>';
  switch(page) {
    case 'home': loadHome(); break;
    case 'messages': loadMessages(opts); break;
    case 'groups': loadGroups(); break;
    case 'notifications': loadNotifications(); break;
    case 'profile': loadProfile(opts.profileUser || CURRENT_USER); break;
    default: loadHome();
  }
  // Close sidebar on mobile after nav
  if (window.innerWidth <= 768) closeSidebar();
}

// ── Sidebar ──────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
    document.getElementById('sidebarOverlay').classList.toggle('open', sb.classList.contains('mobile-open'));
  } else {
    if (sidebarCollapsed) expandSidebar();
    else collapseSidebar();
  }
}

function collapseSidebar(silent = false) {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggle');
  sb.classList.add('collapsed');
  if (btn) btn.querySelector('span').textContent = '›';
  sidebarCollapsed = true;
  if (!silent) localStorage.setItem('sb_collapsed', '1');
}

function expandSidebar() {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggle');
  sb.classList.remove('collapsed');
  if (btn) btn.querySelector('span').textContent = '‹';
  sidebarCollapsed = false;
  localStorage.setItem('sb_collapsed', '0');
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Badges ───────────────────────────────────
async function loadBadges() {
  try {
    const notifs = await API.get('/api/notifications');
    const unread = notifs.filter(n => !n.read).length;
    setNotifBadge(unread);
  } catch(e) {}
}

function setNotifBadge(count) {
  ['notifBadge','notifBadgeTop'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function setMsgBadge(count) {
  const el = document.getElementById('msgBadge');
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

// ── Search ───────────────────────────────────
function initSearch() {
  setupSearchInput('sSearchInput', 'searchResults');
  setupSearchInput('tbSearchInput', 'tbSearchResults');
}

function setupSearchInput(inputId, resultsId) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (!q) { results.classList.remove('open'); return; }
    t = setTimeout(async () => {
      try {
        const data = await API.get(`/api/users/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(data, results);
      } catch(e) {}
    }, 280);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${resultsId}`)) {
      results.classList.remove('open');
    }
  });
}

function renderSearchResults(data, container) {
  const { users = [], groups = [] } = data;
  if (!users.length && !groups.length) {
    container.innerHTML = '<div class="sr-empty">No results found</div>';
    container.classList.add('open');
    return;
  }
  let html = '';
  users.forEach(u => {
    const g = gradientForString(u.username || 'u');
    const av = u.avatar_url
      ? `<div class="sr-av"><img src="${u.avatar_url}" alt=""/></div>`
      : `<div class="sr-av ${g}">${(u.full_name||'U')[0]}</div>`;
    html += `<div class="sr-item" onclick="viewProfileModal('${u.id}');document.querySelectorAll('.search-results').forEach(r=>r.classList.remove('open'));">
      ${av}
      <div><div class="sr-name">${u.full_name}</div><div class="sr-sub">@${u.username} · #${u.nexus_id}</div></div>
    </div>`;
  });
  groups.forEach(g => {
    html += `<div class="sr-item" onclick="goTo('groups');document.querySelectorAll('.search-results').forEach(r=>r.classList.remove('open'));">
      <div class="sr-av g4">${g.banner_emoji||'👥'}</div>
      <div><div class="sr-name">${g.name}</div><div class="sr-sub">${g.group_code} · ${g.member_count} members</div></div>
    </div>`;
  });
  container.innerHTML = html;
  container.classList.add('open');
}

// ── Logout ───────────────────────────────────
function confirmLogout() {
  openModal(`
    <div class="modal-title">Sign Out <button class="modal-close" onclick="closeModal()">×</button></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:20px;">Are you sure you want to sign out?</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="window.location='/logout'" style="flex:1;">Sign Out</button>
    </div>
  `);
}
