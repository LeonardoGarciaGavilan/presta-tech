// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://presta-tech-api.onrender.com';

let socket = null;
let empresaIdActual = null;

// 🔒 El token viene en cookie httpOnly - usamos el user de localStorage para empresaId
function getEmpresaIdFromUser() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.empresaId ?? null;
  } catch {
    return null;
  }
}

export function getSocket() {
  if (!socket) {
    socket = io(`${SOCKET_URL}/alerts`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      withCredentials: true, // 🔒 Enviar cookies automáticamente
    });

    socket.on('connect', () => {
      if (empresaIdActual) {
        socket.emit('join', { empresaId: empresaIdActual });
      }
    });
  }
  return socket;
}

export function connectSocket(empresaIdParam) {
  empresaIdActual = empresaIdParam || getEmpresaIdFromUser();
  if (!empresaIdActual) {
    console.warn('[WS] No se encontró empresaId');
    return;
  }

  const s = getSocket();

  if (!s.connected) {
    s.connect();
  } else {
    s.emit('join', { empresaId: empresaIdActual });
  }
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
  empresaIdActual = null;
}