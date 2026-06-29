import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WS_URL } from '../services/api.js';

/**
 * Custom hook to manage WebSocket connection life-cycle.
 * 
 * @param {string} token - The JWT token to send during initial handshake
 * @returns {Object|null} - The socket client instance
 */
export const useWebSocket = (token) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Normalize connection URL to prevent duplication of path component '/ws' with path option
    let socketHost = WS_URL;
    if (socketHost.endsWith('/ws')) {
      socketHost = socketHost.slice(0, -3);
    }

    // Initialize Connection to real-time engine via CloudFront (wss://).
    // CloudFront forwards the WebSocket Upgrade header through to the ALB,
    // so we can use websocket transport directly without polling fallback.
    // forceNew: true prevents socket reuse across re-renders.
    const socket = io(socketHost, {
      auth: { token },
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[WebSocket Connected] Handshake authorized. ID: ${socket.id}`);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket Handshake Error] Connection failed:', error.message);
    });

    // Cleanup connection upon unmount
    return () => {
      if (socket) {
        console.log('[WebSocket Disconnect] Cleaning connection due to unmount...');
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [token]);

  return socketRef.current;
};

export default useWebSocket;
