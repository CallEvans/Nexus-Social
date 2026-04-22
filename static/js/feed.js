// Nexus Social — Feed
async function loadFeed() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page';

  // Feed column
  const feedCol = document.createElement('div');
  feedCol.className = 'feed-col';
  feedCol.innerHTML = `
    <div class="col-header">
      <div class="col-title">Home</div>
      <div style="display:flex;gap:6px;">
        <div class="tab active" style="padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;background:var(--panel);border:1px solid var(--border2);color:var(--text);">For You</div>
        <div class="tab" style="padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text3);">Friends</div>
      </div>
    </div>
    <div class="feed-scroll">
      <div style="display:flex;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border);overflow-x:auto;" id="storiesRow">
        <div class="add-story-btn" title="Add story">＋</div>
      </div>
      <div class="composer">
        ${renderAvatar(CURRENT_USER, 38, 11)}
        <div class="composer-input" onclick="openPostComposer()">What's on your mind, ${CURRENT_USER.full_name.split(' ')[0]}?</div>
      </div>
      <div id="postsContainer"><div style="padding:40px;text-align:center;color:var(--text3);">Loading feed…</div></div>
    </div>
  `;

  // Right panel
  const rightPanel = document.createElement('div');
  rightPanel.className = 'right-panel';
  rightPanel.id = 'rightPanel';

  page.appendChild(feedCol);
  page.appendChild(rightPanel);
  mc.appendChild(page);

  await Promise.all([fetchPosts(), loadRightPanel()]);
}

async function fetchPosts() {
  try {
    const posts = await API.get('/api/posts/feed');
    const container = document.getElementById('postsContainer');
    if (!posts.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px;">No posts yet. Be the first! ✦</div>';
      return;
    }
    container.innerHTML = posts.map(renderPost).join('');
  } catch(e) {
    document.getElementById('postsContainer').innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">Could not load feed</div>';
  }
}

function renderPost(post) {
  const a = post.author || {};
  const g = gradientForString(a.username || 'u');
  const av = a.avatar_url
    ? `<div class="post-av ${g}" style="overflow:hidden;"><img src="${a.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;"/></div>`
    : `<div class="post-av ${g}">${(a.full_name||'U')[0]}</div>`;
  const flag = a.country ? countryFlag(a.country) : '';
  const media = post.media_url ? `<img class="post-media" src="${post.media_url}" alt="media"/>` : '';

  return `
    <div class="post-card" id="post-${post.id}">
      <div class="post-header">
        ${av}
        <div class="post-meta">
          <div class="post-name">${a.full_name||'User'} <span>${flag}</span> <span class="post-uid">#${a.nexus_id||'??????'}</span></div>
          <div class="post-time">@${a.username||'user'} · ${timeAgo(post.created_at)}</div>
        </div>
        <div class="post-more" onclick="postMenu(this,'${post.id}','${a.id}')">···</div>
      </div>
      ${post.content ? `<div class="post-body">${post.content}</div>` : ''}
      ${media}
      <div class="post-actions">
        <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="likePost('${post.id}',this)"><span>❤️</span> ${post.likes_count||0}</button>
        <button class="action-btn"><span>💬</span> ${post.comments_count||0}</button>
        <button class="action-btn"><span>🔁</span></button>
        <button class="action-btn"><span>🔖</span></button>
      </div>
    </div>
  `;
}

async function likePost(postId, btn) {
  try {
    const data = await API.post(`/api/posts/${postId}/like`, {});
    btn.classList.toggle('liked', data.liked);
    const count = parseInt(btn.textContent.trim().split(' ')[1] || '0');
    btn.innerHTML = `<span>❤️</span> ${data.liked ? count+1 : Math.max(count-1,0)}`;
  } catch(e) {}
}

function postMenu(el, postId, authorId) {
  const existing = document.querySelector('.report-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.className = 'report-menu';
  menu.style.cssText = 'position:absolute;right:8px;top:36px;';
  menu.innerHTML = `
    <div class="rm-item" onclick="copyPostLink('${postId}')">🔗 Copy Link</div>
    ${authorId !== CURRENT_USER.id ? `<div class="rm-item danger" onclick="reportUser('${authorId}');document.querySelector('.report-menu').remove()">🚨 Report</div>` : ''}
    ${authorId === CURRENT_USER.id ? `<div class="rm-item danger" onclick="deletePost('${postId}')">🗑 Delete</div>` : ''}
  `;
  el.closest('.post-card').style.position = 'relative';
  el.closest('.post-card').appendChild(menu);
  document.addEventListener('click', () => menu.remove(), { once: true });
}

function openPostComposer() {
  openModal(`
    <div class="modal-title">New Post <span class="modal-close" onclick="closeModal()">×</span></div>
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:flex-start;">
      ${renderAvatar(CURRENT_USER, 36, 10)}
      <textarea id="postContent" class="fi" placeholder="What's on your mind?" style="flex:1;height:100px;resize:none;"></textarea>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <label class="btn btn-ghost" style="cursor:pointer;font-size:12px;">
        📎 Media
        <input type="file" id="postMedia" accept="image/*,video/*" style="display:none;" onchange="previewMedia(this)"/>
      </label>
      <div id="mediaPreview" style="flex:1;"></div>
      <button class="btn btn-primary" onclick="submitPost()">Post ✦</button>
    </div>
  `);
}

async function submitPost() {
  const content = document.getElementById('postContent').value.trim();
  const mediaInput = document.getElementById('postMedia');
  let media_url = null;

  if (mediaInput.files[0]) {
    const fd = new FormData();
    fd.append('file', mediaInput.files[0]);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.url) media_url = d.url;
  }

  if (!content && !media_url) { toast('Post cannot be empty', 'error'); return; }
  try {
    await API.post('/api/posts/create', { content, media_url });
    closeModal();
    toast('Posted! ✦', 'success');
    fetchPosts();
  } catch(e) { toast(e.message, 'error'); }
}

async function loadRightPanel() {
  const panel = document.getElementById('rightPanel');
  if (!panel) return;
  const g = gradientForString(CURRENT_USER.username || 'u');
  const flag = CURRENT_USER.country ? countryFlag(CURRENT_USER.country) : '';
  const avHtml = CURRENT_USER.avatar_url
    ? `<img src="${CURRENT_USER.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;"/>`
    : (CURRENT_USER.full_name || 'U')[0];

  panel.innerHTML = `
    <div class="my-card">
      <div class="mc-banner">
        <div class="mc-av-wrap">
          <div class="mc-av ${g}">${avHtml}<div class="mc-online"></div></div>
        </div>
      </div>
      <div class="mc-info">
        <div class="mc-name">${CURRENT_USER.full_name} ${flag}</div>
        <div class="mc-handle">@${CURRENT_USER.username} · <span class="uid-tag">#${CURRENT_USER.nexus_id}</span></div>
        <div class="mc-stats">
          <div class="mc-stat"><div class="mc-stat-n" id="friendCount">—</div><div class="mc-stat-l">Friends</div></div>
          <div class="mc-stat"><div class="mc-stat-n">—</div><div class="mc-stat-l">Posts</div></div>
          <div class="mc-stat"><div class="mc-stat-n">—</div><div class="mc-stat-l">Likes</div></div>
        </div>
      </div>
    </div>
    <div class="sec-title">Online Friends</div>
    <div id="onlineFriends"><div style="color:var(--text3);font-size:12px;padding:8px;">Loading…</div></div>
  `;

  try {
    const friends = await API.get('/api/friends/list');
    const el = document.getElementById('onlineFriends');
    document.getElementById('friendCount').textContent = friends.length;
    if (!friends.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0;">No friends yet. Search for people to add!</div>';
      return;
    }
    el.innerHTML = friends.map(f => {
      const other = f.sender_id === CURRENT_USER.id ? f['users!friendships_receiver_id_fkey'] : f['users!friendships_sender_id_fkey'];
      if (!other) return '';
      const fg = gradientForString(other.username || 'u');
      const flag = other.country ? countryFlag(other.country) : '';
      const init = (other.full_name || 'U')[0];
      return `<div class="friend-row" onclick="openDm('${other.id}','${other.username}')">
        <div class="friend-av ${fg}">${other.avatar_url ? `<img src="${other.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:7px;"/>` : init}</div>
        <div><div class="friend-name">${other.full_name}</div><div class="friend-status">@${other.username}</div></div>
        <div class="friend-flag">${flag}</div>
      </div>`;
    }).join('');
  } catch(e) {}
}

function openDm(userId, username) {
  goTo('messages', { openUser: userId, openUsername: username });
}
