// Nexus Social — Home (People You May Know)
async function loadHome() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <div class="page-header">
        <div>
          <div class="page-title">Discover People ✦</div>
          <div class="page-sub">People who match your vibe</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="loadHome()">↻ Refresh</button>
        </div>
      </div>
      <div class="home-wrap" id="homeWrap">
        <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text3);">
          <div class="spinner">✦</div>
        </div>
      </div>
    </div>
  `;
  await fetchSuggestions();
}

async function fetchSuggestions() {
  try {
    const data = await API.get('/api/suggestions');
    const wrap = document.getElementById('homeWrap');
    if (!wrap) return;

    if (!data.length) {
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text3);text-align:center;padding:40px;">
          <div style="font-size:48px;">✦</div>
          <div style="font-family:'Syne';font-weight:700;font-size:16px;color:var(--text2);">No suggestions yet</div>
          <div style="font-size:13px;line-height:1.6;">Complete your profile with your country and interests so we can find your people.</div>
          <button class="btn btn-primary" onclick="goTo('profile')">Complete Profile</button>
        </div>
      `;
      return;
    }

    // Group by match type
    const sameCountry  = data.filter(u => u.match_reasons?.includes('country'));
    const otherMatches = data.filter(u => !u.match_reasons?.includes('country'));

    let html = '';

    if (sameCountry.length) {
      html += `
        <div>
          <div class="section-title">
            🌍 From your country
            <span class="st-badge">${sameCountry.length}</span>
          </div>
          <div class="people-grid">${sameCountry.map(renderPersonCard).join('')}</div>
        </div>
      `;
    }

    if (otherMatches.length) {
      html += `
        <div>
          <div class="section-title">
            ✦ Similar to you
            <span class="st-badge">${otherMatches.length}</span>
          </div>
          <div class="people-grid">${otherMatches.map(renderPersonCard).join('')}</div>
        </div>
      `;
    }

    wrap.innerHTML = html;
  } catch(e) {
    const wrap = document.getElementById('homeWrap');
    if (wrap) wrap.innerHTML = `<div style="padding:30px;text-align:center;color:var(--danger);">Could not load suggestions</div>`;
  }
}

function renderPersonCard(u) {
  const g = gradientForString(u.username || 'u');
  const initial = (u.full_name || 'U')[0];
  const flag = u.country ? countryFlag(u.country) : '';
  const avContent = u.avatar_url
    ? `<img src="${u.avatar_url}" alt="${initial}"/>`
    : initial;

  const reasons = u.match_reasons || [];
  const matchLabel = reasons.includes('country') ? `${flag} Same country`
    : reasons.includes('sexuality') ? '✦ Same sexuality'
    : reasons.includes('gender') ? '✦ Similar'
    : '✦ New';

  const chips = [];
  if (u.pronouns) chips.push(u.pronouns);
  if (u.sexuality && u.sexuality !== 'Prefer not to say') chips.push(u.sexuality);
  if (u.country) chips.push(flag);

  return `
    <div class="person-card" id="pc-${u.id}">
      <div class="pc-banner ${g}">
        <div class="pc-av-wrap">
          <div class="pc-av ${g}">${avContent}</div>
        </div>
        <div class="pc-match">${matchLabel}</div>
      </div>
      <div class="pc-info">
        <div class="pc-name" onclick="viewProfileModal('${u.id}')" style="cursor:pointer;">
          ${u.full_name}
        </div>
        <div class="pc-handle">@${u.username} · <span style="color:var(--accent);font-family:'Syne';font-size:10px;font-weight:700;">#${u.nexus_id}</span></div>
        ${chips.length ? `<div class="pc-chips">${chips.map(c => `<div class="pc-chip">${c}</div>`).join('')}</div>` : ''}
        ${u.bio ? `<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:9px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${u.bio}</div>` : ''}
        <div class="pc-actions">
          <button class="pc-btn pc-btn-add" id="add-${u.id}" onclick="addFriend('${u.id}','${u.full_name}')">+ Add</button>
          <button class="pc-btn pc-btn-msg" onclick="startDm('${u.id}','${u.username}')">Message</button>
        </div>
      </div>
    </div>
  `;
}

async function addFriend(userId, name) {
  const btn = document.getElementById(`add-${userId}`);
  if (!btn) return;
  try {
    await API.post('/api/friends/request', { receiver_id: userId });
    btn.textContent = '✓ Sent';
    btn.className = 'pc-btn pc-btn-added';
    btn.disabled = true;
    toast(`Friend request sent to ${name} ✦`, 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
}

function startDm(userId, username) {
  goTo('messages', { openUser: userId, openUsername: username });
}
