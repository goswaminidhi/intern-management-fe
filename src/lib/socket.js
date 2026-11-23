// import { io } from 'socket.io-client';

// export const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
//   autoConnect: false, // connect only after login
// });
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../api/axios";

// Normalize socket base URL without trailing /api
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || getApiBaseUrl();
const SOCKET_URL = rawSocketUrl.replace(/\/api\/?$/, "");

export const socket = io(SOCKET_URL, {
  autoConnect: false, // connects after login, from NotificationProvider
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});