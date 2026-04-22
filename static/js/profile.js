// Nexus Social — Profile
async function loadProfile(profileUser) {
  const user = profileUser || CURRENT_USER;
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const g = gradientForString(user.username || 'u');
  const initial = (user.full_name || 'U')[0];
  const flag = user.country ? countryFlag(user.country) : '';
  const isOwn = user.id === CURRENT_USER.id;
  const avContent = user.avatar_url
    ? `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"/>`
    : initial;
  const links = (user.personal_links || []).map(l =>
    `<a class="link-pill" href="${l.url}" target="_blank">🔗 ${l.label||l.url}</a>`
  ).join('');

  page.innerHTML = `
    <div class="profile-page">
      <div class="big-banner">
        <div class="big-av-wrap">
          <div class="big-av ${g}">
            ${avContent}
            <div class="big-online"></div>
          </div>
        </div>
        <div class="profile-actions">
          ${isOwn
            ? `<button class="edit-btn" onclick="editProfileModal()">Edit Profile</button>`
            : `<button class="edit-btn primary" onclick="sendFriendReq('${user.id}')">Add Friend ✦</button>
               <button class="edit-btn" onclick="openDm('${user.id}','${user.username}')">Message</button>`
          }
        </div>
      </div>

      <div class="big-name">${user.full_name} ${flag}</div>
      <div class="big-handle">@${user.username} · ${user.pronouns||''}</div>
      <div class="uid-badge">🪪 Nexus ID: <strong>#${user.nexus_id}</strong>${user.nexus_id === '000001' ? ' · Original Member' : ''}</div>

      <div class="big-stats">
        <div class="bs"><div class="bs-n">—</div><div class="bs-l">Friends</div></div>
        <div class="bs"><div class="bs-n">—</div><div class="bs-l">Posts</div></div>
        <div class="bs"><div class="bs-n">—</div><div class="bs-l">Likes</div></div>
        <div class="bs"><div class="bs-n">—</div><div class="bs-l">Groups</div></div>
      </div>

      ${links ? `<div class="links-row">${links}</div>` : ''}
      ${user.bio ? `<p style="color:var(--text2);font-size:13px;line-height:1.6;margin-bottom:16px;">${user.bio}</p>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${user.gender ? `<div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;color:var(--text2);">${user.gender}</div>` : ''}
        ${user.sexuality ? `<div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;color:var(--text2);">${user.sexuality}</div>` : ''}
        ${user.pronouns ? `<div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;color:var(--text2);">✦ ${user.pronouns}</div>` : ''}
      </div>

      <div class="tab-bar">
        <div class="tab active">Posts</div>
        <div class="tab">Media</div>
        <div class="tab">Friends</div>
        ${isOwn ? `<div class="tab" onclick="showDangerZone()">⚙️ Settings</div>` : ''}
      </div>
      <div id="profilePosts"><div style="padding:20px;text-align:center;color:var(--text3);font-size:12px;">Loading posts…</div></div>
    </div>
  `;
  mc.appendChild(page);
}

function editProfileModal() {
  const u = CURRENT_USER;
  openModal(`
    <div class="modal-title">Edit Profile <span class="modal-close" onclick="closeModal()">×</span></div>
    <div style="display:flex;flex-direction:column;gap:12px;max-height:60vh;overflow-y:auto;padding-right:4px;">
      <div class="fg">
        <label class="fl">Full Name</label>
        <input class="fi" id="ep_fullname" value="${u.full_name||''}" />
      </div>
      <div class="fg">
        <label class="fl">Username</label>
        <input class="fi" id="ep_username" value="${u.username||''}" />
      </div>
      <div class="fg">
        <label class="fl">Bio</label>
        <textarea class="fi" id="ep_bio" style="height:72px;resize:none;">${u.bio||''}</textarea>
      </div>
      <div class="fg">
        <label class="fl">Pronouns</label>
        <select class="fi" id="ep_pronouns">
          ${['he/him','she/her','they/them','he/they','she/they','any/all'].map(p => `<option ${u.pronouns===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Profile Picture URL</label>
        <input class="fi" id="ep_avatar" value="${u.avatar_url||''}" placeholder="https://..."/>
        <div class="fhint">Or <label style="color:var(--accent);cursor:pointer;">upload file <input type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(this)"/></label></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="saveProfile()" style="flex:1;">Save ✦</button>
    </div>
  `);
}

async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  toast('Uploading avatar…', 'info');
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const d = await r.json();
  if (d.url) {
    document.getElementById('ep_avatar').value = d.url;
    toast('Avatar uploaded! ✦', 'success');
  }
}

async function saveProfile() {
  const data = {
    full_name: document.getElementById('ep_fullname').value.trim(),
    username: document.getElementById('ep_username').value.trim().toLowerCase(),
    bio: document.getElementById('ep_bio').value.trim(),
    pronouns: document.getElementById('ep_pronouns').value,
    avatar_url: document.getElementById('ep_avatar').value.trim() || null,
  };
  try {
    await API.post('/api/users/update-profile', data);
    Object.assign(CURRENT_USER, data);
    toast('Profile updated! ✦', 'success');
    closeModal();
    loadProfile(CURRENT_USER);
  } catch(e) { toast(e.message, 'error'); }
}

function showDangerZone() {
  openModal(`
    <div class="modal-title" style="color:var(--danger);">⚠️ Danger Zone <span class="modal-close" onclick="closeModal()">×</span></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:20px;line-height:1.6;">Deleting your account is permanent and cannot be undone. All your posts, messages, and data will be removed forever.</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="deleteAccount()" style="flex:1;">Delete My Account</button>
    </div>
  `);
}

async function deleteAccount() {
  try {
    await API.delete('/api/users/delete-account');
    window.location = '/';
  } catch(e) { toast('Could not delete account', 'error'); }
}
