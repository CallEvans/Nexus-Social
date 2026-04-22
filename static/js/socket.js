// Nexus Social — Socket.IO Setup
let socket;

function initSocket() {
  socket = io({ transports: ['websocket'] });

  socket.on('connect', () => console.log('Socket connected'));

  socket.on('new_group_message', (msg) => {
    if (window.onGroupMessage) window.onGroupMessage(msg);
  });

  socket.on('new_dm', (msg) => {
    if (window.onDmMessage) window.onDmMessage(msg);
  });

  socket.on('user_typing', (data) => {
    if (window.onTyping) window.onTyping(data);
  });

  socket.on('user_joined', (data) => {
    if (window.onUserJoined) window.onUserJoined(data);
  });
}
