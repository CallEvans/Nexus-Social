// Nexus Social — UI Utilities

function toast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: '✦' };
  t.innerHTML = `<span>${icons[type]||'✦'}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

function openModal(html) {
  const m = document.getElementById('modal');
  const o = document.getElementById('modalOverlay');
  if (!m || !o) return;
  m.innerHTML = html;
  m.classList.add('open');
  o.classList.add('open');
}

function closeModal() {
  document.getElementById('modal')?.classList.remove('open');
  document.getElementById('modalOverlay')?.classList.remove('open');
}

// Close modal on ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function gradientForString(str) {
  const gs = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return gs[Math.abs(h) % gs.length];
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now  = new Date();
  const d    = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff/60)}m`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d`;
  return d.toLocaleDateString();
}

function countryFlag(code) {
  const flags = {
    MU:'🇲🇺',US:'🇺🇸',GB:'🇬🇧',FR:'🇫🇷',BR:'🇧🇷',IN:'🇮🇳',
    AU:'🇦🇺',CA:'🇨🇦',DE:'🇩🇪',JP:'🇯🇵',KR:'🇰🇷',IT:'🇮🇹',
    ZA:'🇿🇦',NG:'🇳🇬',GH:'🇬🇭',
  };
  return flags[code] || '';
}

function renderAvatar(user, size = 38, radius = 11) {
  const g    = gradientForString(user.username || 'u');
  const init = (user.full_name || user.username || 'U')[0].toUpperCase();
  const style = `width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${Math.floor(size*0.37)}px;`;
  if (user.avatar_url) {
    return `<div class="user-av ${g}" style="${style}"><img src="${user.avatar_url}" alt="${init}"/></div>`;
  }
  return `<div class="user-av ${g}" style="${style}">${init}</div>`;
}

async function reportUser(userId) {
  openModal(`
    <div class="modal-title">Report User <button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="fg">
      <label class="fl">Reason</label>
      <select class="fi" id="reportType">
        <option value="harassment">Harassment</option>
        <option value="spam">Spam / Bot</option>
        <option value="inappropriate_content">Inappropriate Content</option>
        <option value="hate_speech">Hate Speech</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="fg">
      <label class="fl">Details (optional)</label>
      <textarea class="fi" id="reportMsg" placeholder="Describe what happened…" style="height:72px;resize:none;"></textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="submitReport('${userId}')" style="flex:1;">Submit</button>
    </div>
  `);
}

async function submitReport(userId) {
  const type = document.getElementById('reportType')?.value;
  const msg  = document.getElementById('reportMsg')?.value;
  try {
    await API.post('/api/reports/submit', { reported_user_id: userId, type, message: msg });
    toast('Report submitted', 'success');
    closeModal();
  } catch(e) { toast('Could not submit report', 'error'); }
}
