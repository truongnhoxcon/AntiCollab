import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { WS_URL } from '../services/api.js';

/**
 * Custom hook to manage WebSocket connection life-cycle.
 * 
 * @param {string} token - The JWT token to send during initial handshake
 * @returns {Object|null} - The socket client instance
 */
export const useWebSocket = (token) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
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
    const newSocket = io(socketHost, {
      auth: { token },
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log(`[WebSocket Connected] Handshake authorized. ID: ${newSocket.id}`);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket Handshake Error] Connection failed:', error.message);
    });

    setSocket(newSocket);

    // Cleanup connection upon unmount or token change
    return () => {
      console.log('[WebSocket Disconnect] Cleaning connection due to unmount or token change...');
      newSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  return socket;
};

export default useWebSocket;
