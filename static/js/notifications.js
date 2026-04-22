// Nexus Social — Notifications
async function loadNotifications() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';
  page.style.flexDirection = 'column';

  page.innerHTML = `
    <div class="col-header">
      <div class="col-title">Notifications</div>
      <span style="font-size:12px;color:var(--text3);cursor:pointer;" onclick="markAllRead()">Mark all read</span>
    </div>
    <div class="notif-list" id="notifList"><div style="padding:20px;text-align:center;color:var(--text3);">Loading…</div></div>
  `;
  mc.appendChild(page);
  await fetchNotifications();
}

async function fetchNotifications() {
  try {
    const notifs = await API.get('/api/notifications');
    const list = document.getElementById('notifList');
    if (!notifs.length) {
      list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px;">All caught up! ✦</div>';
      return;
    }
    list.innerHTML = notifs.map(renderNotif).join('');
    updateNotifBadge(notifs.filter(n => !n.read).length);
  } catch(e) {}
}

function renderNotif(n) {
  const icons = {
    friend_request: { icon: '👤', cls: 'ni-friend' },
    message_request: { icon: '💬', cls: 'ni-msg' },
    like: { icon: '❤️', cls: 'ni-like' },
    group: { icon: '👥', cls: 'ni-group' },
    welcome: { icon: '✦', cls: 'ni-welcome' },
  };
  const { icon, cls } = icons[n.type] || { icon: '🔔', cls: 'ni-friend' };
  const actions = n.type === 'friend_request' ? `
    <div class="notif-actions">
      <button class="nb nb-accept" onclick="respondFriendReq('${n.meta?.friendship_id||n.id}','accept',this)">Accept</button>
      <button class="nb nb-decline" onclick="respondFriendReq('${n.meta?.friendship_id||n.id}','decline',this)">Decline</button>
    </div>` : '';
  return `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-icon ${cls}">${icon}</div>
      <div style="flex:1;">
        <div class="notif-text">${n.content}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
        ${actions}
      </div>
    </div>
  `;
}

async function respondFriendReq(friendshipId, action, btn) {
  try {
    await API.post('/api/friends/respond', { friendship_id: friendshipId, action });
    const notifItem = btn.closest('.notif-item');
    notifItem.querySelector('.notif-actions').innerHTML = `<span style="font-size:11px;color:var(--${action==='accept'?'online':'text3'});">${action==='accept'?'✓ Friends now!':'Declined'}</span>`;
    toast(action === 'accept' ? 'Friend accepted! ✦' : 'Request declined', action==='accept'?'success':'info');
  } catch(e) { toast(e.message, 'error'); }
}

async function markAllRead() {
  try {
    await API.post('/api/notifications/read-all', {});
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    updateNotifBadge(0);
  } catch(e) {}
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function updateMsgBadge() {
  const badge = document.getElementById('msgBadge');
  if (badge) {
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.style.display = 'flex';
  }
}
