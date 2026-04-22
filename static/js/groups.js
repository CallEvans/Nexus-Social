// Nexus Social — Groups & Real-time Group Chat
let currentGroupId = null;

async function loadGroups() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';
  page.style.flexDirection = 'column';

  page.innerHTML = `
    <div class="col-header">
      <div class="col-title">Groups</div>
      <div style="display:flex;gap:8px;">
        <div id="groupTabDiscover" class="tab active" onclick="switchGroupTab('discover')" style="padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:var(--panel);border:1px solid var(--border2);color:var(--text);">Discover</div>
        <div id="groupTabMine" class="tab" onclick="switchGroupTab('mine')" style="padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text3);">My Groups</div>
        <button class="btn btn-primary" onclick="createGroupModal()" style="font-size:11px;padding:5px 14px;">+ Create</button>
      </div>
    </div>
    <div id="groupsBody" style="flex:1;overflow:hidden;display:flex;"></div>
  `;
  mc.appendChild(page);
  await renderGroupDiscover();
}

async function renderGroupDiscover() {
  const body = document.getElementById('groupsBody');
  body.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:12px;">Loading groups…</div>';
  try {
    const groups = await API.get('/api/groups/discover');
    if (!groups.length) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">No groups yet. Create the first one!</div>';
      return;
    }
    body.innerHTML = `<div class="group-grid">${groups.map(renderGroupCard).join('')}</div>`;
  } catch(e) {
    body.innerHTML = '<div style="padding:20px;color:var(--danger);">Could not load groups</div>';
  }
}

function renderGroupCard(g) {
  const banner = `background:linear-gradient(135deg,rgba(124,111,255,0.2),rgba(255,107,157,0.1));`;
  return `
    <div class="group-card" onclick="openGroupChat('${g.id}','${g.name}','${g.group_code}')">
      <div class="gc-banner" style="${banner}">${g.banner_emoji || '💬'}</div>
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
    btn.style.background = 'var(--accent3)';
    btn.style.color = '#000';
    toast('Joined group! ✦', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function openGroupChat(groupId, groupName, groupCode) {
  currentGroupId = groupId;
  activeDmUser = null;

  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  // Member list
  const memberList = document.createElement('div');
  memberList.style.cssText = 'width:220px;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;';
  memberList.innerHTML = `
    <div class="col-header" style="flex-direction:column;align-items:flex-start;gap:4px;">
      <button onclick="loadGroups()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0;margin-bottom:4px;">← Back</button>
      <div class="col-title" style="font-size:14px;">${groupName}</div>
      <div style="font-size:10px;color:var(--accent);font-family:'Syne';font-weight:700;">✦ ${groupCode}</div>
    </div>
    <div style="padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text3);font-family:'Syne';">Members</div>
    <div id="groupMembersList" style="flex:1;overflow-y:auto;"><div style="padding:12px;color:var(--text3);font-size:12px;">Loading…</div></div>
  `;

  // Chat
  const chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';
  chatPanel.innerHTML = `
    <div class="chat-header">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💬</div>
      <div style="flex:1;">
        <div class="chat-user-name">${groupName}</div>
        <div class="chat-status-line">Group · ${groupCode}</div>
      </div>
    </div>
    <div class="chat-messages" id="groupMessages"></div>
    <div id="groupTyping" style="padding:0 18px;min-height:18px;font-size:11px;color:var(--text3);"></div>
    <div class="chat-input-area">
      <div class="icon-btn" style="width:33px;height:33px;border-radius:9px;font-size:14px;">😊</div>
      <label class="icon-btn" style="width:33px;height:33px;border-radius:9px;font-size:14px;cursor:pointer;">
        📎<input type="file" accept="image/*,video/*" style="display:none;" onchange="sendGroupMedia(this,'${groupId}')"/>
      </label>
      <input class="chat-input" id="groupInput" placeholder="Message ${groupName}…"
        onkeydown="groupKeydown(event,'${groupId}')"
        oninput="emitTyping('${groupId}',true)"/>
      <button class="send-btn" onclick="sendGroupMsg('${groupId}')">➤</button>
    </div>
  `;

  page.appendChild(memberList);
  page.appendChild(chatPanel);
  mc.appendChild(page);

  // Join socket room
  if (socket) socket.emit('join_group', { group_id: groupId });

  await Promise.all([loadGroupMessages(groupId), loadGroupMembers(groupId)]);

  // Real-time
  window.onGroupMessage = (msg) => {
    if (msg.group_id === groupId) {
      const container = document.getElementById('groupMessages');
      if (!container) return;
      const div = document.createElement('div');
      div.innerHTML = renderGroupBubble(msg);
      container.appendChild(div.firstElementChild);
      container.scrollTop = container.scrollHeight;
    }
  };
  window.onTyping = (data) => {
    const area = document.getElementById('groupTyping');
    if (area) {
      area.textContent = `${data.username} is typing…`;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { area.textContent = ''; }, 2000);
    }
  };
}

async function loadGroupMessages(groupId) {
  try {
    const msgs = await API.get(`/api/groups/${groupId}/messages`);
    const container = document.getElementById('groupMessages');
    if (!container) return;
    if (!msgs.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px;">No messages yet. Say hi! ✦</div>';
      return;
    }
    container.innerHTML = '<div class="chat-date">Earlier</div>' + msgs.map(renderGroupBubble).join('');
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

function renderGroupBubble(msg) {
  const isMine = msg.sender_id === CURRENT_USER.id || msg.sender?.id === CURRENT_USER.id;
  const sender = msg.sender || {};
  const g = gradientForString(sender.username || 'u');
  const init = (sender.full_name || 'U')[0];
  const flag = sender.country ? countryFlag(sender.country) : '';
  const avHtml = sender.avatar_url
    ? `<img src="${sender.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;"/>`
    : init;

  return `
    <div class="msg-group ${isMine ? 'mine' : ''}">
      <div class="msg-av ${g}" style="width:26px;height:26px;border-radius:7px;" title="${sender.full_name||''}">${avHtml}</div>
      <div class="msg-bubbles">
        ${!isMine ? `<div style="font-size:10px;color:var(--text3);margin-bottom:2px;">${sender.full_name||''} ${flag}</div>` : ''}
        ${msg.content ? `<div class="bubble">${msg.content}</div>` : ''}
        ${msg.media_url ? `<img class="msg-media" src="${msg.media_url}" alt="media"/>` : ''}
        <div class="msg-time">${timeAgo(msg.created_at)}</div>
      </div>
    </div>
  `;
}

async function loadGroupMembers(groupId) {
  try {
    const members = await API.get(`/api/groups/${groupId}/members`);
    const list = document.getElementById('groupMembersList');
    if (!list) return;
    list.innerHTML = members.map(m => {
      const u = m.user || {};
      const g = gradientForString(u.username || 'u');
      const init = (u.full_name || 'U')[0];
      const flag = u.country ? countryFlag(u.country) : '';
      const roleBadge = m.role === 'owner' ? '⭐' : m.role === 'admin' ? '🛡️' : '';
      return `<div class="friend-row" style="padding:7px 12px;">
        <div class="friend-av ${g}" style="width:30px;height:30px;border-radius:8px;font-size:11px;">${init}</div>
        <div><div class="friend-name" style="font-size:12px;">${u.full_name||'User'} ${roleBadge}</div><div class="friend-status">${flag} @${u.username||''}</div></div>
      </div>`;
    }).join('');
  } catch(e) {}
}

function groupKeydown(e, groupId) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMsg(groupId); }
}

function sendGroupMsg(groupId) {
  const input = document.getElementById('groupInput');
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
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (d.url && socket) {
    socket.emit('group_message', { group_id: groupId, media_url: d.url, content: '' });
  }
}

function createGroupModal() {
  openModal(`
    <div class="modal-title">Create Group <span class="modal-close" onclick="closeModal()">×</span></div>
    <div class="fg" style="margin-bottom:12px;">
      <label class="fl">Group Name <span class="req">*</span></label>
      <input class="fi" id="gName" placeholder="e.g. Friends Together" oninput="previewGroupId(this.value)"/>
      <div class="fhint">Group ID preview: <strong id="gIdPreview" style="color:var(--accent);">—</strong></div>
    </div>
    <div class="fg" style="margin-bottom:12px;">
      <label class="fl">Description</label>
      <textarea class="fi" id="gDesc" placeholder="What's this group about?" style="height:72px;resize:none;"></textarea>
    </div>
    <div class="fg" style="margin-bottom:16px;">
      <label class="fl">Banner Emoji</label>
      <input class="fi" id="gEmoji" placeholder="💬" maxlength="2" value="💬"/>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="submitCreateGroup()" style="flex:1;">Create ✦</button>
    </div>
  `);
}

function previewGroupId(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('');
  const total = words.reduce((s, w) => s + w.replace(/[^a-zA-Z]/g,'').length, 0);
  document.getElementById('gIdPreview').textContent = initials && total ? `${initials}${total}-XX` : '—';
}

async function submitCreateGroup() {
  const name = document.getElementById('gName').value.trim();
  const desc = document.getElementById('gDesc').value.trim();
  const emoji = document.getElementById('gEmoji').value.trim() || '💬';
  if (!name) { toast('Group name required', 'error'); return; }
  try {
    const data = await API.post('/api/groups/create', { name, description: desc, banner_emoji: emoji });
    toast(`Group created! ID: ${data.group_code} ✦`, 'success');
    closeModal();
    loadGroups();
  } catch(e) { toast(e.message, 'error'); }
}

function switchGroupTab(tab) {
  if (tab === 'discover') renderGroupDiscover();
}
