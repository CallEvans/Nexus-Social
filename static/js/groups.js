// Nexus Social — Groups
let currentGroupId = null;

async function loadGroups() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <div class="page-header">
        <div>
          <div class="page-title">Groups</div>
          <div class="page-sub" id="groupSub">Find your community</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" onclick="createGroupModal()">+ Create</button>
        </div>
      </div>
      <div class="tab-bar">
        <div class="tab active" id="tab-discover" onclick="switchGroupTab('discover',this)">Discover</div>
        <div class="tab" id="tab-mine" onclick="switchGroupTab('mine',this)">My Groups</div>
      </div>
      <div class="groups-wrap" id="groupsWrap">
        <div style="text-align:center;padding:30px;color:var(--text3);">Loading…</div>
      </div>
    </div>
  `;
  await renderDiscover();
}

async function renderDiscover() {
  const wrap = document.getElementById('groupsWrap');
  if (!wrap) return;
  try {
    const groups = await API.get('/api/groups/discover');
    const sub    = document.getElementById('groupSub');
    if (sub) sub.textContent = `${groups.length} groups available`;
    if (!groups.length) {
      wrap.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text3);">
        <div style="font-size:40px;margin-bottom:12px;">👥</div>
        <div style="font-family:'Syne';font-weight:700;font-size:15px;color:var(--text2);">No groups yet</div>
        <div style="font-size:12px;margin-top:6px;">Be the first to create one!</div>
        <button class="btn btn-primary btn-sm" style="margin-top:14px;" onclick="createGroupModal()">Create Group</button>
      </div>`;
      return;
    }
    wrap.innerHTML = `<div class="groups-grid">${groups.map(renderGroupCard).join('')}</div>`;
  } catch(e) {
    if (wrap) wrap.innerHTML = `<div style="padding:20px;text-align:center;color:var(--danger);font-size:12px;">Could not load groups</div>`;
  }
}

function renderGroupCard(g) {
  const gradBg = `background:linear-gradient(135deg,rgba(124,111,255,0.2),rgba(255,107,157,0.1));`;
  return `
    <div class="group-card" onclick="openGroupChat('${g.id}','${g.name}','${g.group_code}')">
      <div class="gc-banner" style="${gradBg}">${g.banner_emoji || '💬'}</div>
      <div class="gc-info">
        <div class="gc-name">${g.name}</div>
        <div class="gc-code">✦ ${g.group_code}</div>
        <div class="gc-members">👥 ${g.member_count} members</div>
        <button class="gc-join" onclick="event.stopPropagation();joinGroup('${g.group_code}',this)">Join Group</button>
      </div>
    </div>
  `;
}

async function joinGroup(groupCode, btn) {
  try {
    await API.post('/api/groups/join', { group_code: groupCode });
    btn.textContent = '✓ Joined';
    btn.style.background = 'var(--accent)';
    btn.style.color = 'white';
    btn.disabled = true;
    toast('Joined! ✦', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function openGroupChat(groupId, groupName, groupCode) {
  currentGroupId = groupId;
  const content  = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="messages-wrap">
      <div class="conv-list" id="groupMemberPanel">
        <div class="page-header" style="padding:12px 14px;flex-direction:column;align-items:flex-start;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="loadGroups()" style="padding:4px 8px;margin-bottom:4px;">← Back</button>
          <div class="page-title" style="font-size:14px;">${groupName}</div>
          <div style="font-size:10px;color:var(--accent);font-family:'Syne';font-weight:700;">✦ ${groupCode}</div>
        </div>
        <div style="padding:6px 12px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text3);font-family:'Syne';">Members</div>
        <div class="conv-scroll" id="groupMemberList"><div style="padding:12px;color:var(--text3);font-size:12px;">Loading…</div></div>
      </div>
      <div class="chat-panel">
        <div class="chat-header">
          <div class="chat-header-av g1" style="background:linear-gradient(135deg,var(--accent),var(--accent2));">💬</div>
          <div style="flex:1;">
            <div class="chat-user-name">${groupName}</div>
            <div class="chat-status">Group · ${groupCode}</div>
          </div>
        </div>
        <div class="chat-messages" id="groupMessages"></div>
        <div id="groupTyping" style="padding:0 16px;min-height:16px;font-size:11px;color:var(--text3);"></div>
        <div class="chat-input-area">
          <label class="icon-btn" style="width:32px;height:32px;border-radius:9px;font-size:14px;cursor:pointer;">
            📎<input type="file" accept="image/*,video/*" style="display:none;" onchange="sendGroupMedia(this,'${groupId}')"/>
          </label>
          <input class="chat-input" id="groupInput" placeholder="Message ${groupName}…"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendGroupMsg('${groupId}');}"
            oninput="emitTyping('${groupId}',true)"/>
          <button class="send-btn" onclick="sendGroupMsg('${groupId}')">➤</button>
        </div>
      </div>
    </div>
  `;

  if (socket) socket.emit('join_group', { group_id: groupId });
  await Promise.all([loadGroupMsgs(groupId), loadGroupMembers(groupId)]);

  window.onGroupMessage = (msg) => {
    if (msg.group_id === groupId) appendBubble(msg, 'groupMessages');
  };
  window.onTyping = (data) => {
    const area = document.getElementById('groupTyping');
    if (area) {
      area.textContent = `${data.username} is typing…`;
      clearTimeout(window._gTypingTimer);
      window._gTypingTimer = setTimeout(() => { if (area) area.textContent = ''; }, 2000);
    }
  };
}

async function loadGroupMsgs(groupId) {
  try {
    const msgs      = await API.get(`/api/groups/${groupId}/messages`);
    const container = document.getElementById('groupMessages');
    if (!container) return;
    if (!msgs.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:12px;padding:24px;">No messages yet. Say hi! ✦</div>`;
      return;
    }
    container.innerHTML = '<div class="chat-date">Earlier</div>' + msgs.map(m => renderGroupBubble(m)).join('');
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

function renderGroupBubble(msg) {
  const isMine = (msg.sender_id || msg.sender?.id) === CURRENT_USER.id;
  const sender = msg.sender || {};
  const g      = gradientForString(sender.username || 'u');
  const init   = (sender.full_name || 'U')[0];
  const flag   = sender.country ? countryFlag(sender.country) : '';
  const avHtml = sender.avatar_url
    ? `<div class="msg-av-sm"><img src="${sender.avatar_url}" alt=""/></div>`
    : `<div class="msg-av-sm ${g}">${init}</div>`;

  return `
    <div class="msg-group ${isMine ? 'mine' : ''}">
      ${avHtml}
      <div class="msg-bubbles">
        ${!isMine ? `<div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${sender.full_name||''} ${flag}</div>` : ''}
        ${msg.content ? `<div class="bubble">${msg.content}</div>` : ''}
        ${msg.media_url ? `<img class="msg-media" src="${msg.media_url}" alt="media" onclick="window.open('${msg.media_url}','_blank')"/>` : ''}
        <div class="msg-time">${timeAgo(msg.created_at)}</div>
      </div>
    </div>
  `;
}

async function loadGroupMembers(groupId) {
  try {
    const members = await API.get(`/api/groups/${groupId}/members`);
    const list    = document.getElementById('groupMemberList');
    if (!list) return;
    list.innerHTML = members.map(m => {
      const u    = m.user || {};
      const g    = gradientForString(u.username || 'u');
      const init = (u.full_name || 'U')[0];
      const flag = u.country ? countryFlag(u.country) : '';
      const role = m.role === 'owner' ? ' ⭐' : m.role === 'admin' ? ' 🛡️' : '';
      return `<div class="conv-item" style="padding:8px 12px;">
        <div class="conv-av ${g}" style="width:32px;height:32px;border-radius:9px;font-size:12px;">${init}</div>
        <div class="conv-info">
          <div class="conv-name" style="font-size:12px;">${u.full_name||'User'}${role}</div>
          <div class="conv-last">${flag} @${u.username||''}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {}
}

function sendGroupMsg(groupId) {
  const input = document.getElementById('groupInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  if (socket) socket.emit('group_message', { group_id: groupId, content });
}

async function sendGroupMedia(fileInput, groupId) {
  const file = fileInput.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  toast('Uploading…', 'info');
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.url && socket) socket.emit('group_message', { group_id: groupId, media_url: d.url, content: '' });
  } catch(e) { toast('Upload failed', 'error'); }
}

function createGroupModal() {
  openModal(`
    <div class="modal-title">Create Group <button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="fg">
      <label class="fl">Group Name *</label>
      <input class="fi" id="gName" placeholder="e.g. Friends Together" oninput="previewGid(this.value)" autocomplete="off"/>
      <div class="fhint">Group ID preview: <strong id="gIdPrev" style="color:var(--accent);">—</strong></div>
    </div>
    <div class="fg">
      <label class="fl">Description</label>
      <textarea class="fi" id="gDesc" placeholder="What's this group about?" style="height:68px;resize:none;"></textarea>
    </div>
    <div class="fg">
      <label class="fl">Banner Emoji</label>
      <input class="fi" id="gEmoji" value="💬" maxlength="2"/>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="submitCreateGroup()" style="flex:1;">Create ✦</button>
    </div>
  `);
}

function previewGid(name) {
  const words    = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('');
  const total    = words.reduce((s, w) => s + w.replace(/[^a-zA-Z]/g, '').length, 0);
  const el       = document.getElementById('gIdPrev');
  if (el) el.textContent = initials && total ? `${initials}${total}-XX` : '—';
}

async function submitCreateGroup() {
  const name  = document.getElementById('gName')?.value.trim();
  const desc  = document.getElementById('gDesc')?.value.trim();
  const emoji = document.getElementById('gEmoji')?.value.trim() || '💬';
  if (!name) { toast('Group name is required', 'error'); return; }
  try {
    const data = await API.post('/api/groups/create', { name, description: desc, banner_emoji: emoji });
    toast(`Created! ID: ${data.group_code} ✦`, 'success');
    closeModal();
    loadGroups();
  } catch(e) { toast(e.message, 'error'); }
}

function switchGroupTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'discover') renderDiscover();
  else renderMyGroups();
}

async function renderMyGroups() {
  const wrap = document.getElementById('groupsWrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);">Loading…</div>';
  try {
    const all = await API.get('/api/groups/discover');
    wrap.innerHTML = `<div class="groups-grid">${all.map(renderGroupCard).join('')}</div>`;
  } catch(e) {}
}
