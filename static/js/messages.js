// Nexus Social — Messages & Real-time DMs
let activeDmUser = null;
let activeGroupId = null;
let typingTimer = null;

async function loadMessages(opts = {}) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  // DM List
  const dmList = document.createElement('div');
  dmList.className = 'dm-list';
  dmList.innerHTML = `
    <div class="col-header">
      <div class="col-title">Messages</div>
      <div class="icon-btn" style="width:28px;height:28px;border-radius:8px;font-size:13px;" onclick="newMessageModal()">✏️</div>
    </div>
    <div style="padding:8px 12px;">
      <div class="search-bar" style="max-width:100%;">
        <span class="si">🔍</span>
        <input placeholder="Search conversations…" oninput="filterDms(this.value)" style="font-size:12px;"/>
      </div>
    </div>
    <div class="dm-scroll" id="dmScroll"><div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">Loading…</div></div>
  `;

  // Chat panel
  const chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';
  chatPanel.id = 'chatPanel';
  chatPanel.innerHTML = `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:13px;flex-direction:column;gap:10px;">
      <div style="font-size:40px;">💬</div>
      <div>Select a conversation to start chatting</div>
    </div>
  `;

  page.appendChild(dmList);
  page.appendChild(chatPanel);
  mc.appendChild(page);

  await loadConversations();

  if (opts.openUser) {
    openDmChat(opts.openUser, opts.openUsername || opts.openUser);
  }

  // Socket listeners
  window.onDmMessage = (msg) => {
    if (activeDmUser && (msg.sender.id === activeDmUser || msg.receiver_id === activeDmUser)) {
      appendDmBubble(msg);
    }
    loadConversations();
    updateMsgBadge();
  };
}

async function loadConversations() {
  try {
    const convs = await API.get('/api/messages/conversations');
    const scroll = document.getElementById('dmScroll');
    if (!scroll) return;
    if (!convs.length) {
      scroll.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">No conversations yet. Search for people to message!</div>';
      return;
    }
    scroll.innerHTML = convs.map(c => {
      const g = gradientForString(c.other_username || 'u');
      const init = (c.other_full_name || 'U')[0];
      const flag = c.other_country ? countryFlag(c.other_country) : '';
      const avImg = `<div class="dm-av ${g}" style="position:relative;">${init}</div>`;
      return `<div class="dm-item ${activeDmUser === c.other_user_id ? 'active' : ''}" onclick="openDmChat('${c.other_user_id}','${c.other_username}')">
        ${avImg}
        <div class="dm-info">
          <div class="dm-name">${c.other_full_name} ${flag}<span class="dm-time">${timeAgo(c.last_message_time)}</span></div>
          <div class="dm-last">${c.last_message || ''}</div>
        </div>
        ${c.unread_count > 0 ? '<div class="unread-dot"></div>' : ''}
      </div>`;
    }).join('');
  } catch(e) {}
}

async function openDmChat(userId, username) {
  activeDmUser = userId;
  activeGroupId = null;

  // Update DM list active state
  document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));

  const panel = document.getElementById('chatPanel');
  if (!panel) return;

  let profile = null;
  try { profile = await API.get(`/api/users/profile/${userId}`); } catch(e) {}
  const name = profile ? profile.full_name : username;
  const g = gradientForString(username || 'u');
  const init = (name || 'U')[0];
  const flag = profile?.country ? countryFlag(profile.country) : '';
  const uid = profile?.nexus_id || '';

  panel.innerHTML = `
    <div class="chat-header">
      <div class="dm-av ${g}" style="width:40px;height:40px;border-radius:12px;font-size:14px;position:relative;">
        ${profile?.avatar_url ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>` : init}
        <div class="f-online" style="position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;border-radius:50%;background:var(--online);border:2px solid var(--bg);"></div>
      </div>
      <div style="flex:1;">
        <div class="chat-user-name">${name} ${flag} <span style="font-size:10px;color:var(--text3);font-weight:400;font-family:'DM Sans';">#${uid}</span></div>
        <div class="chat-status-line">@${username}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <div class="icon-btn" style="width:32px;height:32px;border-radius:9px;font-size:13px;" title="Voice call">📞</div>
        <div class="icon-btn" style="width:32px;height:32px;border-radius:9px;font-size:13px;" onclick="reportUser('${userId}')">⋯</div>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div id="typingArea" style="padding:0 18px;min-height:18px;font-size:11px;color:var(--text3);"></div>
    <div class="chat-input-area">
      <div class="icon-btn" style="width:33px;height:33px;border-radius:9px;font-size:14px;">😊</div>
      <label class="icon-btn" style="width:33px;height:33px;border-radius:9px;font-size:14px;cursor:pointer;">
        📎<input type="file" accept="image/*,video/*" style="display:none;" onchange="sendMediaDm(this,'${userId}')"/>
      </label>
      <input class="chat-input" id="dmInput" placeholder="Message ${name}…" onkeydown="dmKeydown(event,'${userId}')" oninput="emitTyping('${userId}',false)"/>
      <button class="send-btn" onclick="sendDm('${userId}')">➤</button>
    </div>
  `;

  await loadDmMessages(userId);
}

async function loadDmMessages(userId) {
  try {
    const msgs = await API.get(`/api/messages/dm/${userId}`);
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!msgs.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px;">Say hello to start the conversation ✦</div>`;
      return;
    }

    let html = '<div class="chat-date">Today</div>';
    msgs.forEach(msg => { html += renderDmBubble(msg); });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

function renderDmBubble(msg) {
  const isMine = msg.sender_id === CURRENT_USER.id || msg.sender?.id === CURRENT_USER.id;
  const sender = msg.sender || {};
  const g = gradientForString(sender.username || 'u');
  const init = (sender.full_name || 'U')[0];
  const avHtml = sender.avatar_url
    ? `<img src="${sender.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;"/>`
    : init;

  return `
    <div class="msg-group ${isMine ? 'mine' : ''}">
      <div class="msg-av ${g}" style="width:26px;height:26px;border-radius:7px;">${avHtml}</div>
      <div class="msg-bubbles">
        ${msg.content ? `<div class="bubble">${msg.content}</div>` : ''}
        ${msg.media_url ? `<img class="msg-media" src="${msg.media_url}" alt="media"/>` : ''}
        <div class="msg-time">${timeAgo(msg.created_at)}${isMine && msg.seen ? ' · Seen ✓✓' : ''}</div>
      </div>
    </div>
  `;
}

function appendDmBubble(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = renderDmBubble(msg);
  container.appendChild(div.firstElementChild);
  container.scrollTop = container.scrollHeight;
}

function dmKeydown(e, userId) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDm(userId); }
}

function sendDm(userId) {
  const input = document.getElementById('dmInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  if (socket) socket.emit('dm_message', { receiver_id: userId, content });
}

async function sendMediaDm(fileInput, userId) {
  const file = fileInput.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  toast('Uploading…', 'info');
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (d.url && socket) {
    socket.emit('dm_message', { receiver_id: userId, media_url: d.url, content: '' });
  }
}

function emitTyping(targetId, isGroup) {
  if (socket) socket.emit('typing', { target_id: targetId, is_group: isGroup });
}

window.onTyping = (data) => {
  const area = document.getElementById('typingArea');
  if (area) {
    area.textContent = `${data.username} is typing…`;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { area.textContent = ''; }, 2000);
  }
};

function newMessageModal() {
  openModal(`
    <div class="modal-title">New Message <span class="modal-close" onclick="closeModal()">×</span></div>
    <div class="fg" style="margin-bottom:14px;">
      <label class="fl">Search user</label>
      <input class="fi" id="newMsgSearch" placeholder="@username" oninput="searchForNewMsg(this.value)"/>
    </div>
    <div id="newMsgResults"></div>
  `);
}

async function searchForNewMsg(q) {
  if (!q) return;
  const r = document.getElementById('newMsgResults');
  try {
    const data = await API.get(`/api/users/search?q=${encodeURIComponent(q)}`);
    r.innerHTML = data.users.map(u => `
      <div class="sr-item" onclick="closeModal();openDmChat('${u.id}','${u.username}')">
        <div class="sr-av ${gradientForString(u.username)}">${(u.full_name||'U')[0]}</div>
        <div><div class="sr-name">${u.full_name}</div><div class="sr-sub">@${u.username}</div></div>
      </div>
    `).join('') || '<div style="padding:12px;color:var(--text3);font-size:12px;">No users found</div>';
  } catch(e) {}
}
