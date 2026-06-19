import { useEffect, useRef, useState } from 'react';

/**
 * A custom hook to handle multi-party WebRTC calling using a Mesh P2P model.
 * It interacts with the socket instance provided by useWebSocket hook.
 *
 * @param {Object} socket - Socket.io client instance
 * @param {string|null} channelId - The active voice channel ID
 * @returns {Object} WebRTC states and utility functions
 */
export const useWebRTC = (socket, channelId) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // format: { [socketId]: MediaStream }
  const [peersInfo, setPeersInfo] = useState({}); // format: { [socketId]: username }
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peersRef = useRef({}); // format: { [socketId]: RTCPeerConnection }
  const iceCandidatesQueueRef = useRef({}); // format: { [socketId]: [RTCIceCandidate] }
  const localStreamRef = useRef(null);
  const socketRef = useRef(socket);
  const channelIdRef = useRef(channelId);

  // Sync refs to avoid stale closures in socket listeners
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  // STUN Configuration fallback
  const rtcConfig = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
    ],
  };

  // Process queued ICE candidates after setRemoteDescription completes
  const processIceQueue = async (peerSocketId) => {
    const queue = iceCandidatesQueueRef.current[peerSocketId];
    const pc = peersRef.current[peerSocketId];
    if (queue && pc && pc.remoteDescription) {
      console.log(`[WebRTC] Processing ${queue.length} queued ICE candidates for ${peerSocketId}`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Error adding queued ICE candidate for ${peerSocketId}:`, err);
        }
      }
      delete iceCandidatesQueueRef.current[peerSocketId];
    }
  };

  // Helper to create peer connection
  const createPeerConnection = (peerSocketId, stream) => {
    if (peersRef.current[peerSocketId]) {
      console.log(`[WebRTC] Peer connection for ${peerSocketId} already exists.`);
      return peersRef.current[peerSocketId];
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for peer socket ${peerSocketId}`);
    const pc = new RTCPeerConnection(rtcConfig);

    // Attach ICE candidates listener
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log(`[WebRTC] Sending ICE candidate to ${peerSocketId}`);
        socketRef.current.emit('webrtc_ice_candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Attach remote track listener
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${peerSocketId}, track kind: ${event.track.kind}`);
      setRemoteStreams((prev) => {
        let currentStream = prev[peerSocketId];
        if (!currentStream) {
          currentStream = new MediaStream();
        }
        
        // Add the track if it is not already present in the stream
        const trackExists = currentStream.getTracks().some(t => t.id === event.track.id);
        if (!trackExists) {
          currentStream.addTrack(event.track);
        }

        return {
          ...prev,
          [peerSocketId]: currentStream,
        };
      });
    };

    // Add local tracks to peer connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    peersRef.current[peerSocketId] = pc;
    return pc;
  };

  // Helper to destroy connection for a specific peer
  const closePeerConnection = (peerSocketId) => {
    const pc = peersRef.current[peerSocketId];
    if (pc) {
      pc.close();
      delete peersRef.current[peerSocketId];
    }
    delete iceCandidatesQueueRef.current[peerSocketId];
    
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[peerSocketId];
      return updated;
    });
    setPeersInfo((prev) => {
      const updated = { ...prev };
      delete updated[peerSocketId];
      return updated;
    });
  };

  // Setup media and join voice room
  useEffect(() => {
    if (!socket || !channelId) {
      // If we are disconnecting, run cleanup
      if (localStreamRef.current || Object.keys(peersRef.current).length > 0) {
        console.log('[WebRTC] Resetting calling state due to disconnection...');
        cleanupAll();
      }
      return;
    }

    const startCall = async () => {
      try {
        console.log('[WebRTC] Requesting local camera/microphone media permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsMuted(false);
        setIsCameraOff(false);

        // Tell signaling server we are entering the voice room
        console.log(`[WebRTC] Emitting join_voice_channel for room ${channelId}`);
        socket.emit('join_voice_channel', { channelId });

      } catch (err) {
        console.error('[WebRTC] User media capture failed:', err);
        alert('Failed to access microphone or camera. Please check your system settings and try again.');
      }
    };

    startCall();

    // Listeners definition
    const handleGetCurrentUsers = async ({ users }) => {
      console.log('[WebRTC Socket] get_current_voice_users list:', users);
      
      const newPeersInfo = {};
      const targetUsers = [];

      users.forEach((u) => {
        if (typeof u === 'object' && u !== null) {
          if (u.socketId === socket.id) return;
          newPeersInfo[u.socketId] = u.username || 'Remote User';
          targetUsers.push(u.socketId);
        } else if (typeof u === 'string') {
          if (u === socket.id) return;
          newPeersInfo[u] = 'Remote User';
          targetUsers.push(u);
        }
      });

      setPeersInfo((prev) => ({ ...prev, ...newPeersInfo }));
      
      for (const peerSocketId of targetUsers) {
        try {
          const pc = createPeerConnection(peerSocketId, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          console.log(`[WebRTC Socket] Sending Offer to ${peerSocketId}`);
          socket.emit('webrtc_offer', {
            targetSocketId: peerSocketId,
            offer,
          });
        } catch (error) {
          console.error(`[WebRTC] Failed to send Offer to ${peerSocketId}:`, error);
        }
      }
    };

    const handleUserJoinedVoice = ({ socketId, username }) => {
      console.log(`[WebRTC Socket] user_joined_voice: Peer ${socketId} (${username || 'unknown'}) entered.`);
      
      setPeersInfo((prev) => ({
        ...prev,
        [socketId]: username || 'Remote User',
      }));
      // Wait for their Offer
    };

    const handleWebRTCOffer = async ({ senderSocketId, offer, senderUsername }) => {
      console.log(`[WebRTC Socket] Received Offer from ${senderSocketId}`);
      if (senderUsername) {
        setPeersInfo((prev) => ({
          ...prev,
          [senderSocketId]: senderUsername,
        }));
      }

      try {
        const pc = createPeerConnection(senderSocketId, localStreamRef.current);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process any candidates that arrived before description was set
        await processIceQueue(senderSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log(`[WebRTC Socket] Sending Answer to ${senderSocketId}`);
        socket.emit('webrtc_answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (error) {
        console.error(`[WebRTC] Failed to respond to Offer from ${senderSocketId}:`, error);
      }
    };

    const handleWebRTCAnswer = async ({ senderSocketId, answer }) => {
      console.log(`[WebRTC Socket] Received Answer from ${senderSocketId}`);
      try {
        const pc = peersRef.current[senderSocketId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Process any candidates that arrived before description was set
          await processIceQueue(senderSocketId);
        } else {
          console.warn(`[WebRTC] Received Answer but no connection existed for ${senderSocketId}`);
        }
      } catch (error) {
        console.error(`[WebRTC] Failed to set Remote Answer description for ${senderSocketId}:`, error);
      }
    };

    const handleWebRTCIceCandidate = async ({ senderSocketId, candidate }) => {
      console.log(`[WebRTC Socket] Received ICE candidate from ${senderSocketId}`);
      try {
        const pc = peersRef.current[senderSocketId];
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // If connection is not created yet or remote description is not set, queue the candidate
          console.log(`[WebRTC] Queueing ICE candidate for ${senderSocketId}`);
          if (!iceCandidatesQueueRef.current[senderSocketId]) {
            iceCandidatesQueueRef.current[senderSocketId] = [];
          }
          iceCandidatesQueueRef.current[senderSocketId].push(candidate);
        }
      } catch (error) {
        console.error(`[WebRTC] Error adding remote ICE candidate from ${senderSocketId}:`, error);
      }
    };

    const handleUserLeftVoice = ({ socketId }) => {
      console.log(`[WebRTC Socket] user_left_voice: Peer ${socketId} left the voice room.`);
      closePeerConnection(socketId);
    };

    // Attach Socket events
    socket.on('get_current_voice_users', handleGetCurrentUsers);
    socket.on('user_joined_voice', handleUserJoinedVoice);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);
    socket.on('user_left_voice', handleUserLeftVoice);

    return () => {
      socket.off('get_current_voice_users', handleGetCurrentUsers);
      socket.off('user_joined_voice', handleUserJoinedVoice);
      socket.off('webrtc_offer', handleWebRTCOffer);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleWebRTCIceCandidate);
      socket.off('user_left_voice', handleUserLeftVoice);
    };
  }, [socket, channelId]);

  // General teardown function
  const cleanupAll = () => {
    // Send leave signal
    if (socketRef.current && channelIdRef.current) {
      console.log(`[WebRTC] Emitting leave_voice_channel for room ${channelIdRef.current}`);
      socketRef.current.emit('leave_voice_channel', { channelId: channelIdRef.current });
    }

    // Close and remove peer connections
    Object.keys(peersRef.current).forEach((peerSocketId) => {
      console.log(`[WebRTC] Closing peer connection for ${peerSocketId}`);
      peersRef.current[peerSocketId].close();
    });
    peersRef.current = {};
    iceCandidatesQueueRef.current = {};

    // Release camera/microphone tracks
    if (localStreamRef.current) {
      console.log('[WebRTC] Stopping local media stream tracks');
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams({});
    setPeersInfo({});
    setIsMuted(false);
    setIsCameraOff(false);
  };

  // Run general cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  // Utility to toggle microphone track
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!audioTracks[0]?.enabled);
    }
  };

  // Utility to toggle camera track
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!videoTracks[0]?.enabled);
    }
  };

  const leaveChannel = () => {
    cleanupAll();
  };

  return {
    localStream,
    remoteStreams,
    peersInfo,
    isMuted,
    isCameraOff,
    toggleMic,
    toggleCamera,
    leaveChannel,
  };
};

export default useWebRTC;
