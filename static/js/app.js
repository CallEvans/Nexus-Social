// Nexus Social — App Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  goTo(CURRENT_PAGE, PROFILE_USER ? { profileUser: PROFILE_USER } : {});
  loadNotifCount();
});

function goTo(page, opts = {}) {
  // Update nav
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  switch(page) {
    case 'feed': loadFeed(); break;
    case 'messages': loadMessages(opts); break;
    case 'groups': loadGroups(); break;
    case 'notifications': loadNotifications(); break;
    case 'profile': loadProfile(opts.profileUser || CURRENT_USER); break;
    default: loadFeed();
  }
}

async function loadNotifCount() {
  try {
    const notifs = await API.get('/api/notifications');
    const unread = notifs.filter(n => !n.read).length;
    updateNotifBadge(unread);
  } catch(e) {}
}

function openDm(userId, username) {
  goTo('messages', { openUser: userId, openUsername: username });
}
