let socket;
let activeRole;

const ADMIN_ROLES = ['admin', 'super_admin'];

const emitRooms = () => {
  // لازم نتأكد إن الاتصال قائم فعليًا قبل الإرسال، مش بس إن الـ instance موجود
  if (!socket || !socket.connected || !activeRole) return;
  socket.emit('join_users');
  if (ADMIN_ROLES.includes(activeRole)) socket.emit('join_admin');
};

function createSocket() {
  if (typeof window === 'undefined' || !window.io) return null;

  const instance = window.io({
    withCredentials: true,
    // FIX: السيرفر بقى مقصور على WebSocket بس (transports: ['websocket'])
    // عشان مفيش sticky sessions قدام الـ PM2 cluster workers. لازم الـ
    // client يطابقه ويشيل الـ polling من الأول، وإلا هيحاول يعمل
    // handshake بالـ polling الافتراضي وهيترفض من السيرفر.
    transports: ['websocket'],
    // إعدادات backoff صريحة عشان نمنع محاولات إعادة اتصال متلاحقة بسرعة
    // (السلوك اللي ظاهر في الـ console: sid جديد كل شوية و 400 Bad Request)
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });

  instance.on('connect', emitRooms);
  instance.on('connect_error', (err) => {
    console.warn('[socket] connect_error:', err?.message || err);
  });
  instance.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason);
  });

  return instance;
}

export function getSocket() {
  // singleton حقيقي: لو فيه instance قائم بالفعل (حتى لو مش متصل حاليًا) منرجعوش نعمل واحد جديد
  if (!socket) socket = createSocket();
  return socket;
}

export function onEvent(name, handler) {
  const instance = getSocket();
  if (!instance) return () => {};
  instance.on(name, handler);
  return () => instance.off(name, handler);
}

export function joinRooms(role) {
  // لو نفس الـ role ومتصل بالفعل، متعملش إعادة إرسال / إعادة إنشاء بلا داعي
  if (activeRole === role && socket?.connected) return;
  activeRole = role;
  const instance = getSocket();
  // لو متصل بالفعل ابعت فورًا، وإلا هيتبعت تلقائيًا لما يحصل 'connect'
  if (instance?.connected) emitRooms();
}

export function disconnectSocket() {
  if (!socket) return;
  socket.off('connect', emitRooms);
  socket.disconnect();
  socket = undefined;
  activeRole = undefined;
}