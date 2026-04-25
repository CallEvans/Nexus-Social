// Nexus Social — Profile
async function loadProfile(profileUser) {
    const user = profileUser || CURRENT_USER;
    const isOwn = user.id === CURRENT_USER.id;
    const g = gradientForString(user.username || 'u');
    const init = (user.full_name || 'U')[0];
    const flag = user.country ? countryFlag(user.country) : '';
    const avContent = user.avatar_url
        ? `<img src="${user.avatar_url}" alt="${init}" style="width:100%;height:100%;object-fit:cover;">`
        : init;

    // Build personal links safely
    const links = (user.personal_links || [])
        .filter(l => l && (l.url || l.label))
        .map(l => {
            const label = l.label || l.url || '';
            const url = l.url || '#';
            return `<a href="${url}" target="_blank" rel="noopener" class="p-link">${label}</a>`;
        })
        .join('');

    const content = document.getElementById('pageContent');
    content.innerHTML = `
        <div class="profile-page">
            <div class="p-header">
                <div class="p-avatar-wrap">
                    <div class="p-av ${g}" style="width:80px;height:80px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;font-family:'Syne',sans-serif;overflow:hidden;">
                        ${avContent}
                    </div>
                    ${isOwn ? '<div class="p-av-overlay" onclick="editProfileModal()">✏️</div>' : ''}
                </div>
                <div class="p-actions">
                    ${isOwn
                        ? `<button class="btn-pill" onclick="editProfileModal()">Edit Profile</button>`
                        : `<button class="btn-pill primary" onclick="addFriendProfile('${user.id}','${user.full_name}')">Add Friend ✦</button>
                           <button class="btn-pill" onclick="startDm('${user.id}','${user.username}')">Message</button>`
                    }
                </div>
            </div>

            <div class="p-main">
                <div class="p-name-row">
                    <h1 class="p-name">${user.full_name} ${flag}</h1>
                    <span class="p-pronouns">@${user.username} · ${user.pronouns || ''}</span>
                </div>
                <div class="p-nexus">Nexus ID: #${user.nexus_id}${user.nexus_id === '000001' ? ' · <span class="badge-original">Original Member ⭐</span>' : ''}</div>

                <div class="p-stats">
                    <div class="p-stat">
                        <span class="p-stat-n" id="pFriends">—</span>
                        <span class="p-stat-l">Friends</span>
                    </div>
                    <div class="p-stat">
                        <span class="p-stat-n">—</span>
                        <span class="p-stat-l">Groups</span>
                    </div>
                    <div class="p-stat">
                        <span class="p-stat-n">${user.age || '—'}</span>
                        <span class="p-stat-l">Age</span>
                    </div>
                </div>

                ${user.bio ? `<div class="p-bio">${user.bio}</div>` : ''}

                <div class="p-details">
                    ${user.gender ? `<span class="p-tag">${user.gender}</span>` : ''}
                    ${user.sexuality && user.sexuality !== 'Prefer not to say' ? `<span class="p-tag">${user.sexuality}</span>` : ''}
                    ${user.pronouns ? `<span class="p-tag">✦ ${user.pronouns}</span>` : ''}
                </div>

                ${links ? `<div class="p-links">${links}</div>` : ''}

                <div class="p-footer-actions">
                    ${isOwn
                        ? `<button class="btn-pill danger" onclick="editProfileModal()">✏️ Edit Profile</button>
                           <button class="btn-pill danger-outline" onclick="deleteAccount()">⚠️ Delete Account</button>`
                        : `<button class="btn-pill danger-outline" onclick="reportUser('${user.id}')">🚩 Report</button>`
                    }
                </div>
            </div>
        </div>
    `;

    // Load friend count
    try {
        const friends = await API.get('/api/friends/list');
        const el = document.getElementById('pFriends');
        if (el) el.textContent = friends.length;
    } catch (e) {}
}

async function addFriendProfile(userId, name) {
    try {
        await API.post('/api/friends/request', { receiver_id: userId });
        toast(`Friend request sent to ${name} ✦`, 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

function startDm(userId, username) {
    goTo('messages', { openUser: userId, openUsername: username });
}

function editProfileModal() {
    const u = CURRENT_USER;
    openModal(`
        <div class="modal-card">
            <div class="modal-header">
                <h3>Edit Profile</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="field">
                    <label>Full Name</label>
                    <input id="epName" value="${u.full_name || ''}" placeholder="Your name">
                </div>
                <div class="field">
                    <label>Username</label>
                    <input id="epUsername" value="${u.username || ''}" placeholder="username">
                </div>
                <div class="field">
                    <label>Bio</label>
                    <textarea id="epBio" rows="3" placeholder="About you…">${u.bio || ''}</textarea>
                </div>
                <div class="field">
                    <label>Pronouns</label>
                    <select id="epPronouns">
                        ${['he/him','she/her','they/them','he/they','she/they','any/all'].map(p =>
                            `<option value="${p}" ${u.pronouns === p ? 'selected' : ''}>${p}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="field">
                    <label>Profile Picture URL</label>
                    <input id="epAvatar" value="${u.avatar_url || ''}" placeholder="https://…">
                </div>
                <div class="field">
                    <label>Or upload file</label>
                    <input type="file" accept="image/*" onchange="uploadAvatarFile(this)">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-pill" onclick="closeModal()">Cancel</button>
                <button class="btn-pill primary" onclick="saveProfile()">Save ✦</button>
            </div>
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
            const el = document.getElementById('epAvatar');
            if (el) el.value = d.url;
            toast('Uploaded! ✦', 'success');
        }
    } catch (e) {
        toast('Upload failed', 'error');
    }
}

async function saveProfile() {
    const data = {
        full_name: document.getElementById('epName')?.value,
        username: document.getElementById('epUsername')?.value,
        bio: document.getElementById('epBio')?.value,
        pronouns: document.getElementById('epPronouns')?.value,
        avatar_url: document.getElementById('epAvatar')?.value,
    };

    try {
        await API.post('/api/users/update-profile', data);
        closeModal();
        toast('Profile updated ✦', 'success');
        // Reload profile
        const newUser = { ...CURRENT_USER, ...data };
        loadProfile(newUser);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;

    try {
        await API.delete('/api/users/delete-account');
        window.location.href = '/';
    } catch (e) {
        toast('Failed to delete account', 'error');
    }
}
