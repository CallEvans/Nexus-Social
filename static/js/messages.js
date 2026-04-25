// Nexus Social — Messages (fully fixed)
let activeDmUser = null;
let typingTimer  = null;

async function loadMessages(opts = {}) {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="messages-wrap" id="messagesWrap">
      <div class="conv-list" id="convList">
        <div class="page-header" style="padding:12px 14px;">
          <div class="page-title" style="font-size:15px;">Messages</div>
          <div class="page-actions">
            <button class="icon-btn" onclick="newMsgModal()" title="New message" style="width:30px;height:30px;border-radius:8px;font-size:13px;">✏️</button>
          </div>
        </div>
        <div class="conv-search">
          <div class="conv-search-bar">
            <span style="color:var(--text3);font-size:13px;">🔍</span>
            <input placeholder="Search conversations…" oninput="filterConvs(this.value)" />
          </div>
        </div>
        <div class="conv-scroll" id="convScroll">
          <div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">Loading…</div>
        </div>
      </div>
      <div class="chat-panel" id="chatPanel">
        <div class="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <div class="chat-empty-text">Your messages</div>
          <div class="chat-empty-sub">Select a conversation or start a new one</div>
          <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="newMsgModal()">New Message ✦</button>
        </div>
      </div>
    </div>
  `;

  await loadConversations();

  if (opts.openUser) {
    openDmChat(opts.openUser, opts.openUsername || '');
  }

  window.onDmMessage = (msg) => {
    const isActive = activeDmUser && (msg.sender?.id === activeDmUser || msg.receiver_id === activeDmUser);
    if (isActive) appendBubble(msg, 'chatMessages');
    loadConversations();
  };
}

async function loadConversations() {
  const scroll = document.getElementById('convScroll');
  if (!scroll) return;
  try {
    const convs = await API.get('/api/messages/conversations');

    if (!convs || !convs.length) {
      scroll.innerHTML = `
        <div class="conv-empty">
          <div class="ce-icon">💬</div>
          <div class="ce-title">No conversations yet</div>
          <div class="ce-sub">Add friends and start chatting</div>
        </div>
      `;
      return;
    }

    scroll.innerHTML = convs.map(c => {
      const g = gradientForString(c.other_username || 'u');
      const init = (c.other_full_name || 'U')[0];
      const flag = c.other_country ? countryFlag(c.other_country) : '';
      const avHtml = `<div class="conv-av ${g}">${init}</div>`;
      const isActive = activeDmUser === c.other_user_id;
      return `
        <div class="conv-item ${isActive ? 'active' : ''}" id="conv-${c.other_user_id}"
          onclick="openDmChat('${c.other_user_id}','${c.other_username}')">
          ${avHtml}
          <div class="conv-info">
            <div class="conv-name">
              ${c.other_full_name} ${flag}
              <span class="conv-time">${timeAgo(c.last_message_time)}</span>
            </div>
            <div class="conv-last">${c.last_message || 'Say hello!'}</div>
          </div>
          ${c.unread_count > 0 ? '<div class="conv-unread"></div>' : ''}
        </div>
      `;
    }).join('');
  } catch(e) {
    if (scroll) scroll.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:12px;">Could not load conversations</div>`;
  }
}

async function openDmChat(userId, username) {
  activeDmUser = userId;

  // Update active state
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  const convEl = document.getElementById(`conv-${userId}`);
  if (convEl) convEl.classList.add('active');

  // Mobile: show chat panel
  if (window.innerWidth <= 768) {
    document.getElementById('convList')?.classList.add('mobile-hidden');
    document.getElementById('chatPanel')?.classList.add('mobile-open');
  }

  let profile = null;
  try { profile = await API.get(`/api/users/profile/${userId}`); } catch(e) {}

  const name  = profile?.full_name || username;
  const flag  = profile?.country ? countryFlag(profile.country) : '';
  const uid   = profile?.nexus_id || '';
  const g     = gradientForString(username || 'u');
  const init  = (name || 'U')[0];
  const avHtml = profile?.avatar_url
    ? `<div class="chat-header-av"><img src="${profile.avatar_url}" alt=""/></div>`
    : `<div class="chat-header-av ${g}">${init}</div>`;

  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="chat-header">
      ${window.innerWidth <= 768 ? `<button class="btn btn-ghost btn-sm" onclick="backToConvList()" style="padding:4px 8px;">←</button>` : ''}
      ${avHtml}
      <div style="flex:1;">
        <div class="chat-user-name">${name} ${flag}
          <span style="font-size:10px;color:var(--text3);font-weight:400;font-family:'DM Sans';">#${uid}</span>
        </div>
        <div class="chat-status">@${username}</div>
      </div>
      <button class="icon-btn" style="width:30px;height:30px;border-radius:8px;font-size:13px;" onclick="viewProfileModal('${userId}')">👤</button>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div id="typingArea" style="padding:0 16px;min-height:16px;font-size:11px;color:var(--text3);"></div>
    <div class="chat-input-area">
      <label class="icon-btn" style="width:32px;height:32px;border-radius:9px;font-size:14px;cursor:pointer;" title="Send media">
        📎<input type="file" accept="image/*,video/*" style="display:none;" onchange="sendMediaDm(this,'${userId}')"/>
      </label>
      <input class="chat-input" id="dmInput" placeholder="Message ${name}…"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendDm('${userId}');}"
        oninput="emitTyping('${userId}',false)"/>
      <button class="send-btn" onclick="sendDm('${userId}')">➤</button>
    </div>
  `;

  await fetchDmHistory(userId);

  window.onTyping = (data) => {
    const area = document.getElementById('typingArea');
    if (area) {
      area.textContent = `${data.username} is typing…`;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { if (area) area.textContent = ''; }, 2000);
    }
  };
}

function backToConvList() {
  document.getElementById('convList')?.classList.remove('mobile-hidden');
  document.getElementById('chatPanel')?.classList.remove('mobile-open');
  activeDmUser = null;
}

async function fetchDmHistory(userId) {
  try {
    const msgs = await API.get(`/api/messages/dm/${userId}`);
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (!msgs.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:12px;padding:24px;">No messages yet. Say hello! ✦</div>`;
      return;
    }
    container.innerHTML = '<div class="chat-date">Earlier</div>' + msgs.map(m => renderBubbleHtml(m)).join('');
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

function renderBubbleHtml(msg) {
  const isMine = (msg.sender_id || msg.sender?.id) === CURRENT_USER.id;
  const sender = msg.sender || {};
  const g      = gradientForString(sender.username || 'u');
  const init   = (sender.full_name || 'U')[0];
  const avHtml = sender.avatar_url
    ? `<div class="msg-av-sm"><img src="${sender.avatar_url}" alt=""/></div>`
    : `<div class="msg-av-sm ${g}">${init}</div>`;

  return `
    <div class="msg-group ${isMine ? 'mine' : ''}">
      ${avHtml}
      <div class="msg-bubbles">
        ${msg.content ? `<div class="bubble">${msg.content}</div>` : ''}
        ${msg.media_url ? `<img class="msg-media" src="${msg.media_url}" alt="media" onclick="window.open('${msg.media_url}','_blank')"/>` : ''}
        <div class="msg-time">${timeAgo(msg.created_at)}${isMine && msg.seen ? ' · Seen ✓' : ''}</div>
      </div>
    </div>
  `;
}

function appendBubble(msg, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = renderBubbleHtml(msg);
  const el = div.firstElementChild;
  if (el) { container.appendChild(el); container.scrollTop = container.scrollHeight; }
}

function sendDm(userId) {
  const input = document.getElementById('dmInput');
  if (!input) return;
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
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.url && socket) socket.emit('dm_message', { receiver_id: userId, media_url: d.url, content: '' });
  } catch(e) { toast('Upload failed', 'error'); }
}

function emitTyping(targetId, isGroup) {
  if (socket) socket.emit('typing', { target_id: targetId, is_group: isGroup });
}

function filterConvs(q) {
  document.querySelectorAll('.conv-item').forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function newMsgModal() {
  openModal(`
    <div class="modal-title">New Message <button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="fg">
      <label class="fl">Search user</label>
      <input class="fi" id="newMsgQ" placeholder="@username or name…" oninput="searchNewMsg(this.value)" autocomplete="off"/>
    </div>
    <div id="newMsgRes"></div>
  `);
}

async function searchNewMsg(q) {
  if (!q || q.length < 2) return;
  const res = document.getElementById('newMsgRes');
  try {
    const data = await API.get(`/api/users/search?q=${encodeURIComponent(q)}`);
    res.innerHTML = data.users.map(u => `
      <div class="sr-item" onclick="closeModal();openDmChat('${u.id}','${u.username}')">
        <div class="sr-av ${gradientForString(u.username)}">${(u.full_name||'U')[0]}</div>
        <div><div class="sr-name">${u.full_name}</div><div class="sr-sub">@${u.username}</div></div>
      </div>
    `).join('') || '<div class="sr-empty">No users found</div>';
  } catch(e) {}
}
