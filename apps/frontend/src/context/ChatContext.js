import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from './AuthContext.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import api from '../services/api.js';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socket = useWebSocket(token);

  const [servers, setServers] = useState([]);
  const [activeServerId, setActiveServerId] = useState(() => {
    return localStorage.getItem('activeServerId') || null;
  });
  const [activeChannelId, setActiveChannelId] = useState(() => {
    return localStorage.getItem('activeChannelId') || null;
  });
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Keep ref of active ids to use inside socket event listeners
  const activeChannelIdRef = useRef(localStorage.getItem('activeChannelId') || null);
  const activeServerIdRef = useRef(localStorage.getItem('activeServerId') || null);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      localStorage.setItem('activeChannelId', activeChannelId);
    } else {
      localStorage.removeItem('activeChannelId');
    }
  }, [activeChannelId]);

  useEffect(() => {
    activeServerIdRef.current = activeServerId;
    if (activeServerId) {
      localStorage.setItem('activeServerId', activeServerId);
    } else {
      localStorage.removeItem('activeServerId');
    }
  }, [activeServerId]);

  // Fetch servers on authentication
  useEffect(() => {
    if (token) {
      fetchServers();
    } else {
      // Only reset active server and channel if there is no token in localStorage.
      // This prevents wiping out the states while AuthContext is restoring the session on page reload.
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setServers([]);
        setActiveServerId(null);
        setActiveChannelId(null);
        setMessages([]);
        setMembers([]);
      }
    }
  }, [token]);

  // Handle server and channel change ws triggers
  useEffect(() => {
    if (socket && activeServerId && activeChannelId) {
      console.log(`[Socket Emit] Joining channel ${activeChannelId} in server ${activeServerId}`);
      socket.emit('join_channel', {
        serverId: activeServerId,
        channelId: activeChannelId,
      });

      // Fetch message history for the new channel
      fetchMessages(activeChannelId);
    }
  }, [socket, activeServerId, activeChannelId]);

  // Connect socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages (event name 'message' is sent by backend-realtime)
    const handleNewMessage = (msg) => {
      console.log('[WebSocket Message] Received message:', msg);
      if (msg.channelId === activeChannelIdRef.current) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === msg.id)) return prev;

          // If this message was sent by the current user, reconcile and replace the optimistic temp message
          if (msg.sender?.id === user?.id) {
            const tempIndex = prev.findIndex(
              (m) => m.id && m.id.toString().startsWith('temp-') && m.content === msg.content
            );
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = msg;
              return updated;
            }
          }

          return [...prev, msg];
        });
      }
    };

    // Listen for presence change (event name 'presence_change' is sent by backend-realtime)
    const handlePresenceChange = (data) => {
      console.log('[WebSocket Presence] Change received:', data);
      const { userId, username, status } = data;
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, status } : m))
      );
    };

    socket.on('message', handleNewMessage);
    socket.on('receive_message', handleNewMessage); // Compatibility fallback
    socket.on('presence_change', handlePresenceChange);
    socket.on('user_online', (data) => handlePresenceChange({ ...data, status: 'online' }));
    socket.on('user_offline', (data) => handlePresenceChange({ ...data, status: 'offline' }));

    return () => {
      socket.off('message', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('presence_change', handlePresenceChange);
      socket.off('user_online');
      socket.off('user_offline');
    };
  }, [socket]);

  /**
   * Fetch all servers the authenticated user is a member of.
   */
  const fetchServers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/servers');
      setServers(response.data);
      
      // If we have an activeServerId from localStorage, verify it still exists in the fetched list.
      // If it doesn't exist anymore, reset to Home (null).
      if (activeServerIdRef.current) {
        const serverExists = response.data.some((s) => s.id === activeServerIdRef.current);
        if (!serverExists) {
          setActiveServerId(null);
          setActiveChannelId(null);
        }
      }
    } catch (error) {
      console.error('[ChatContext] Failed to fetch servers from API:', error.message);
      setServers([]);
      setActiveServerId(null);
      setActiveChannelId(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch messages for a specific channel.
   * Calls GET /api/channels/:channelId/messages
   */
  const fetchMessages = async (channelId) => {
    try {
      const response = await api.get(`/api/channels/${channelId}/messages`);
      // Sort messages in ascending order for chat window rendering
      const messageList = [...response.data.messages].reverse();
      setMessages(messageList);
      
      // Update active users/members list based on actual senders in chat history + self
      const uniqueSenders = {};
      messageList.forEach((m) => {
        if (m.sender && m.sender.id) {
          uniqueSenders[m.sender.id] = m.sender.username;
        }
      });
      
      const memberList = Object.keys(uniqueSenders).map((id) => ({
        id,
        username: uniqueSenders[id],
        status: id === user?.id ? 'online' : 'offline', // Default status logic
      }));

      // Add self to the member list if not already present
      if (user && !memberList.some((m) => m.id === user.id)) {
        memberList.push({ id: user.id, username: user.username, status: 'online' });
      }

      setMembers(memberList);
    } catch (error) {
      console.error('[ChatContext] Failed to fetch channel messages from API:', error.message);
      setMessages([]);
      setMembers(user ? [{ id: user.id, username: user.username, status: 'online' }] : []);
    }
  };

  /**
   * Send a chat message via WebSocket.
   */
  const sendMessage = (content) => {
    if (!socket || !activeServerId || !activeChannelId) {
      console.warn('[ChatContext] Socket connection is not ready or channel/server is not selected');
      return;
    }

    console.log('[Socket Emit] send_message:', content);
    socket.emit('send_message', {
      serverId: activeServerId,
      channelId: activeChannelId,
      content,
    });

    // Optimistic local update for self (WS will broadcast back but this provides immediate UI responsiveness)
    const tempMessage = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      channelId: activeChannelId,
      serverId: activeServerId,
      sender: {
        id: user?.id || 'me',
        username: user?.username || 'You',
      },
    };
    setMessages((prev) => [...prev, tempMessage]);
  };

  /**
   * Helper to create a server using POST /api/servers
   */
  const createServer = async (name) => {
    try {
      const response = await api.post('/api/servers', { name });
      const createdServer = response.data.server;
      
      const updatedServer = {
        id: createdServer.id,
        name: createdServer.name,
        abbr: name.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 3),
        channels: [],
      };

      setServers((prev) => [...prev, updatedServer]);
      setActiveServerId(updatedServer.id);
      setActiveChannelId(null);
      return { success: true, server: updatedServer };
    } catch (error) {
      console.error('[ChatContext] Server creation failed:', error.message);
      return { success: false, error: error.response?.data?.error || 'Failed to create server' };
    }
  };

  /**
   * Helper to create a channel using POST /api/servers/:serverId/channels
   */
  const createChannel = async (name, type = 'text') => {
    if (!activeServerId) return { success: false, error: 'No active server selected' };

    try {
      const response = await api.post(`/api/servers/${activeServerId}/channels`, { name, type });
      const createdChannel = response.data.channel;

      setServers((prev) => 
        prev.map((s) => {
          if (s.id === activeServerId) {
            return {
              ...s,
              channels: [...(s.channels || []), createdChannel],
            };
          }
          return s;
        })
      );
      
      if (type === 'text') {
        setActiveChannelId(createdChannel.id);
      }
      return { success: true, channel: createdChannel };
    } catch (error) {
      console.error('[ChatContext] Channel creation failed:', error.message);
      return { success: false, error: error.response?.data?.error || 'Failed to create channel' };
    }
  };

  return (
    <ChatContext.Provider
      value={{
        servers,
        activeServerId,
        setActiveServerId,
        channels: servers.find((s) => s.id === activeServerId)?.channels || [],
        activeChannelId,
        setActiveChannelId,
        messages,
        members,
        loading,
        sendMessage,
        createServer,
        createChannel,
        fetchServers,
        socket,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

