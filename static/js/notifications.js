// Nexus Social — Notifications (fixed)
async function loadNotifications() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <div class="page-header">
        <div>
          <div class="page-title">Notifications</div>
          <div class="page-sub" id="notifSub">Loading…</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark all read</button>
        </div>
      </div>
      <div class="notif-list" id="notifList">
        <div style="padding:30px;text-align:center;color:var(--text3);">Loading…</div>
      </div>
    </div>
  `;
  await fetchNotifications();
}

async function fetchNotifications() {
  try {
    const notifs = await API.get('/api/notifications');
    const list   = document.getElementById('notifList');
    const sub    = document.getElementById('notifSub');
    if (!list) return;

    const unread = notifs.filter(n => !n.read).length;
    if (sub) sub.textContent = unread > 0 ? `${unread} unread` : 'All caught up';
    setNotifBadge(unread);

    if (!notifs.length) {
      list.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text3);">
        <div style="font-size:40px;margin-bottom:12px;">🔔</div>
        <div style="font-family:'Syne';font-weight:700;font-size:15px;color:var(--text2);">All caught up ✦</div>
        <div style="font-size:12px;margin-top:6px;">No notifications yet</div>
      </div>`;
      return;
    }
    list.innerHTML = notifs.map(renderNotif).join('');
  } catch(e) {}
}

function renderNotif(n) {
  const iconMap = {
    friend_request: { icon: '👤', cls: 'ni-friend' },
    message_request: { icon: '💬', cls: 'ni-msg' },
    like: { icon: '❤️', cls: 'ni-like' },
    group: { icon: '👥', cls: 'ni-group' },
    welcome: { icon: '✦', cls: 'ni-welcome' },
    system: { icon: '📢', cls: 'ni-system' },
  };
  const { icon, cls } = iconMap[n.type] || { icon: '🔔', cls: 'ni-friend' };

  // Only show accept/decline for PENDING friend requests
  const isPending = n.type === 'friend_request' && !n.meta?.resolved;
  const actions = isPending ? `
    <div class="notif-actions">
      <button class="nb nb-accept" onclick="respondFriendReq('${n.id}','${n.meta?.sender_id}','accept',this)">Accept</button>
      <button class="nb nb-decline" onclick="respondFriendReq('${n.id}','${n.meta?.sender_id}','decline',this)">Decline</button>
    </div>` : '';

  return `
    <div class="notif-item ${n.read ? '' : 'unread'}" id="notif-${n.id}">
      <div class="notif-icon ${cls}">${icon}</div>
      <div style="flex:1;">
        <div class="notif-text">${n.content}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
        ${actions}
      </div>
    </div>
  `;
}

async function respondFriendReq(notifId, senderId, action, btn) {
  try {
    // Find the friendship record
    const friends = await API.get('/api/friends/pending');
    const match   = friends.find(f => f.sender_id === senderId);

    if (match) {
      await API.post('/api/friends/respond', {
        friendship_id: match.id,
        action
      });
    }

    // Mark notification as resolved so actions disappear
    await API.post(`/api/notifications/${notifId}/resolve`, {});

    // Update UI
    const actionsEl = btn.closest('.notif-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `<span style="font-size:11px;color:var(--${action==='accept'?'success':'text3'});">
        ${action === 'accept' ? '✓ Friends now!' : 'Declined'}
      </span>`;
    }

    // Remove unread dot
    const item = document.getElementById(`notif-${notifId}`);
    if (item) item.classList.remove('unread');

    toast(action === 'accept' ? 'Friends now! ✦' : 'Request declined', action === 'accept' ? 'success' : 'info');
    setNotifBadge(Math.max(0, parseInt(document.getElementById('notifBadgeTop')?.textContent || '0') - 1));

    // If accepted, refresh conversations so friend appears
    if (action === 'accept') {
      setTimeout(() => loadConversations && loadConversations(), 500);
    }
  } catch(e) {
    toast(e.message || 'Something went wrong', 'error');
  }
}

async function markAllRead() {
  try {
    await API.post('/api/notifications/read-all', {});
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    const sub = document.getElementById('notifSub');
    if (sub) sub.textContent = 'All caught up';
    setNotifBadge(0);
    toast('All marked as read', 'info');
  } catch(e) {}
}
