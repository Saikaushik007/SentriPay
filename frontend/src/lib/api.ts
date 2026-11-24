import { io, Socket } from 'socket.io-client';
import { useState, useEffect } from 'react';

// Read VITE_BACKEND_URL or fallback to relative URL for dev proxy
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  return fetch(url, options);
}

// Single unified Socket.io instance
export const socket: Socket = io(BACKEND_URL || window.location.origin, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export type SocketStatus = 'Connected' | 'Reconnecting' | 'Offline';

export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(socket.connected ? 'Connected' : 'Offline');

  useEffect(() => {
    const handleConnect = () => setStatus('Connected');
    const handleDisconnect = () => setStatus('Offline');
    const handleReconnectAttempt = () => setStatus('Reconnecting');
    const handleConnectError = () => setStatus('Offline');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      setStatus('Connected');
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  return status;
}
