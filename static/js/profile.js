// Nexus Social — Profile
async function loadProfile(profileUser) {
  const user  = profileUser || CURRENT_USER;
  const isOwn = user.id === CURRENT_USER.id;
  const g     = gradientForString(user.username || 'u');
  const init  = (user.full_name || 'U')[0];
  const flag  = user.country ? countryFlag(user.country) : '';
  const avContent = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="${init}"/>`
    : init;
  const links = (user.personal_links || []).map(l =>
    `<a class="link-pill" href="${l.url||l}" target="_blank" rel="noopener">🔗 ${l.label||l.url||l}</a>`
  ).join('');

  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <div class="profile-wrap">
        <div class="profile-banner">
          <div class="profile-av-wrap">
            <div class="profile-av ${g}">
              ${avContent}
              ${isOwn ? '<div class="profile-av-online"></div>' : ''}
            </div>
          </div>
          <div class="profile-top-actions">
            ${isOwn
              ? `<button class="btn btn-ghost btn-sm" onclick="editProfileModal()">Edit Profile</button>`
              : `<button class="btn btn-primary btn-sm" onclick="addFriendProfile('${user.id}','${user.full_name}')">Add Friend ✦</button>
                 <button class="btn btn-ghost btn-sm" onclick="startDm('${user.id}','${user.username}')">Message</button>`
            }
          </div>
        </div>

        <div class="profile-name">${user.full_name} ${flag}</div>
        <div class="profile-handle">@${user.username} · ${user.pronouns || ''}</div>
        <div class="uid-badge">🪪 Nexus ID: <strong>#${user.nexus_id}</strong>${user.nexus_id === '000001' ? ' · Original Member ⭐' : ''}</div>

        <div class="profile-stats">
          <div class="ps"><div class="ps-n" id="pFriends">—</div><div class="ps-l">Friends</div></div>
          <div class="ps"><div class="ps-n" id="pGroups">—</div><div class="ps-l">Groups</div></div>
          <div class="ps"><div class="ps-n">${user.age || '—'}</div><div class="ps-l">Age</div></div>
        </div>

        ${user.bio ? `<p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:14px;">${user.bio}</p>` : ''}

        <div class="profile-chips">
          ${user.gender ? `<div class="p-chip">${user.gender}</div>` : ''}
          ${user.sexuality && user.sexuality !== 'Prefer not to say' ? `<div class="p-chip">${user.sexuality}</div>` : ''}
          ${user.pronouns ? `<div class="p-chip">✦ ${user.pronouns}</div>` : ''}
        </div>

        ${links ? `<div class="links-row">${links}</div>` : ''}

        ${isOwn ? `
          <div style="margin-top:8px;padding-top:14px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="editProfileModal()">✏️ Edit Profile</button>
            <button class="btn btn-danger btn-sm" onclick="dangerZoneModal()">⚠️ Delete Account</button>
          </div>
        ` : `
          <button class="btn btn-danger btn-sm" style="margin-top:10px;" onclick="reportUser('${user.id}')">🚨 Report</button>
        `}
      </div>
    </div>
  `;

  // Load friend/group counts
  try {
    const friends = await API.get('/api/friends/list');
    const el = document.getElementById('pFriends');
    if (el) el.textContent = friends.length;
  } catch(e) {}
}

async function addFriendProfile(userId, name) {
  try {
    await API.post('/api/friends/request', { receiver_id: userId });
    toast(`Friend request sent to ${name} ✦`, 'success');
  } catch(e) { toast(e.message, 'error'); }
}

function startDm(userId, username) {
  goTo('messages', { openUser: userId, openUsername: username });
}

function editProfileModal() {
  const u = CURRENT_USER;
  openModal(`
    <div class="modal-title">Edit Profile <button class="modal-close" onclick="closeModal()">×</button></div>
    <div style="max-height:55vh;overflow-y:auto;padding-right:4px;display:flex;flex-direction:column;gap:0;">
      <div class="fg">
        <label class="fl">Full Name</label>
        <input class="fi" id="ep_name" value="${u.full_name||''}"/>
      </div>
      <div class="fg">
        <label class="fl">Username</label>
        <input class="fi" id="ep_user" value="${u.username||''}"/>
      </div>
      <div class="fg">
        <label class="fl">Bio</label>
        <textarea class="fi" id="ep_bio" style="height:68px;resize:none;">${u.bio||''}</textarea>
      </div>
      <div class="fg">
        <label class="fl">Pronouns</label>
        <select class="fi" id="ep_pronouns">
          ${['he/him','she/her','they/them','he/they','she/they','any/all'].map(p =>
            `<option ${u.pronouns===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="fl">Profile Picture URL</label>
        <input class="fi" id="ep_av" value="${u.avatar_url||''}" placeholder="https://…"/>
        <div class="fhint">Or <label style="color:var(--accent);cursor:pointer;">upload file <input type="file" accept="image/*" style="display:none;" onchange="uploadAvatarFile(this)"/></label></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="saveProfile()" style="flex:1;">Save ✦</button>
    </div>
  `);
}

async function uploadAvatarFile(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  toast('Uploading…', 'info');
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.url) {
      const el = document.getElementById('ep_av');
      if (el) el.value = d.url;
      toast('Avatar uploaded ✦', 'success');
    }
  } catch(e) { toast('Upload failed', 'error'); }
}

async function saveProfile() {
  const data = {
    full_name:  document.getElementById('ep_name')?.value.trim(),
    username:   document.getElementById('ep_user')?.value.trim().toLowerCase(),
    bio:        document.getElementById('ep_bio')?.value.trim(),
    pronouns:   document.getElementById('ep_pronouns')?.value,
    avatar_url: document.getElementById('ep_av')?.value.trim() || null,
  };
  try {
    await API.post('/api/users/update-profile', data);
    Object.assign(CURRENT_USER, data);
    toast('Profile saved ✦', 'success');
    closeModal();
    loadProfile(CURRENT_USER);
  } catch(e) { toast(e.message, 'error'); }
}

function dangerZoneModal() {
  openModal(`
    <div class="modal-title" style="color:var(--danger);">⚠️ Delete Account <button class="modal-close" onclick="closeModal()">×</button></div>
    <p style="color:var(--text2);font-size:13px;line-height:1.6;margin-bottom:18px;">
      This is permanent. All your data, messages, and groups will be deleted forever. This cannot be undone.
    </p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-danger" onclick="deleteMyAccount()" style="flex:1;">Delete Forever</button>
    </div>
  `);
}

async function deleteMyAccount() {
  try {
    await API.delete('/api/users/delete-account');
    window.location.href = '/';
  } catch(e) { toast('Could not delete account', 'error'); }
}

async function viewProfileModal(userId) {
  try {
    const u    = await API.get(`/api/users/profile/${userId}`);
    const g    = gradientForString(u.username || 'u');
    const init = (u.full_name || 'U')[0];
    const flag = u.country ? countryFlag(u.country) : '';
    const avContent = u.avatar_url
      ? `<img src="${u.avatar_url}" alt="${init}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"/>`
      : init;

    openModal(`
      <div class="modal-title">${u.full_name} <button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:6px 0 14px;">
        <div class="${g}" style="width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;font-family:'Syne';overflow:hidden;">
          ${avContent}
        </div>
        <div style="text-align:center;">
          <div style="font-family:'Syne';font-weight:700;font-size:16px;">${u.full_name} ${flag}</div>
          <div style="color:var(--text2);font-size:12px;margin-top:2px;">@${u.username}</div>
          <div style="margin-top:4px;display:inline-block;background:linear-gradient(135deg,rgba(124,111,255,0.15),rgba(255,107,157,0.15));border:1px solid rgba(124,111,255,0.25);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;font-family:'Syne';color:var(--accent);">#${u.nexus_id}</div>
          ${u.bio ? `<div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.5;">${u.bio}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
          ${u.pronouns ? `<div class="p-chip">${u.pronouns}</div>` : ''}
          ${u.sexuality && u.sexuality !== 'Prefer not to say' ? `<div class="p-chip">${u.sexuality}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;width:100%;margin-top:6px;">
          <button class="btn btn-primary" style="flex:1;" onclick="addFriendProfile('${u.id}','${u.full_name}');closeModal()">Add Friend ✦</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="startDm('${u.id}','${u.username}');closeModal()">Message</button>
          <button class="btn btn-danger" style="padding:8px 10px;" onclick="reportUser('${u.id}')">🚨</button>
        </div>
      </div>
    `);
  } catch(e) { toast('Could not load profile', 'error'); }
}
