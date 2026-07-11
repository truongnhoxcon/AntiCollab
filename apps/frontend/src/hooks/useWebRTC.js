import { useEffect, useRef, useState } from 'react';

/**
 * A custom hook to handle multi-party WebRTC calling using a Mesh P2P model.
 * It interacts with the socket instance provided by useWebSocket hook.
 *
 * @param {Object} socket - Socket.io client instance
 * @param {string|null} channelId - The active voice channel ID
 * @returns {Object} WebRTC states and utility functions
 */
export const useWebRTC = (socket, channelId, options = {}) => {
  const { inputMode = 'activity', pttKey = 'CapsLock', localUsername } = options;
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // format: { [socketId]: MediaStream }
  const [peersInfo, setPeersInfo] = useState({}); // format: { [socketId]: username }
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(() => {
    return localStorage.getItem('voice_camera_off') === 'true';
  });
  const [remoteCameraStates, setRemoteCameraStates] = useState({}); // format: { [socketId]: boolean }

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
    setRemoteCameraStates((prev) => {
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
        // mediaDevices is only available in secure contexts (HTTPS or localhost).
        // Show a clear error instead of crashing with "Cannot read properties of undefined".
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('[WebRTC] navigator.mediaDevices is unavailable. The page must be served over HTTPS for camera/microphone access.');
          alert('Camera and microphone access requires a secure connection (HTTPS). Please contact the administrator.');
          return;
        }

        console.log('[WebRTC] Requesting local camera/microphone media permissions...');
        const savedMic = localStorage.getItem('voice_selected_mic');
        const savedCamera = localStorage.getItem('voice_selected_camera');

        const constraints = {
          audio: savedMic ? { deviceId: { ideal: savedMic } } : true,
          video: savedCamera ? { deviceId: { ideal: savedCamera } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Apply remembered camera state
        const rememberedCameraOff = localStorage.getItem('voice_camera_off') === 'true';
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !rememberedCameraOff;
        });

        setLocalStream(stream);
        localStreamRef.current = stream;

        // Apply initial input mode mute state
        if (inputMode === 'push') {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsMuted(true);
        } else {
          setIsMuted(false);
        }

        setIsCameraOff(rememberedCameraOff);

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
            isCameraOff: localStreamRef.current ? localStreamRef.current.getVideoTracks().every(t => !t.enabled) : true
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

    const handleWebRTCOffer = async ({ senderSocketId, offer, senderUsername, isCameraOff }) => {
      console.log(`[WebRTC Socket] Received Offer from ${senderSocketId}, camera off: ${isCameraOff}`);
      if (senderUsername) {
        setPeersInfo((prev) => ({
          ...prev,
          [senderSocketId]: senderUsername,
        }));
      }
      if (isCameraOff !== undefined) {
        setRemoteCameraStates((prev) => ({ ...prev, [senderSocketId]: isCameraOff }));
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
          isCameraOff: localStreamRef.current ? localStreamRef.current.getVideoTracks().every(t => !t.enabled) : true
        });
      } catch (error) {
        console.error(`[WebRTC] Failed to respond to Offer from ${senderSocketId}:`, error);
      }
    };

    const handleWebRTCAnswer = async ({ senderSocketId, answer, isCameraOff }) => {
      console.log(`[WebRTC Socket] Received Answer from ${senderSocketId}, camera off: ${isCameraOff}`);
      if (isCameraOff !== undefined) {
        setRemoteCameraStates((prev) => ({ ...prev, [senderSocketId]: isCameraOff }));
      }
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

    const handleUserCameraUpdated = ({ socketId, isCameraOff }) => {
      console.log(`[WebRTC Socket] user_camera_updated: Peer ${socketId} camera off = ${isCameraOff}`);
      setRemoteCameraStates((prev) => ({ ...prev, [socketId]: isCameraOff }));
    };

    socket.on('user_camera_updated', handleUserCameraUpdated);

    return () => {
      socket.off('get_current_voice_users', handleGetCurrentUsers);
      socket.off('user_joined_voice', handleUserJoinedVoice);
      socket.off('webrtc_offer', handleWebRTCOffer);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleWebRTCIceCandidate);
      socket.off('user_left_voice', handleUserLeftVoice);
      socket.off('user_camera_updated', handleUserCameraUpdated);

      // Clean up previous voice session completely when channelId changes or unmounts
      cleanupAll();
    };
  }, [socket, channelId]);

  // Sync mic track state when inputMode changes dynamically
  useEffect(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (inputMode === 'push') {
        audioTracks.forEach((track) => {
          track.enabled = false;
        });
        setIsMuted(true);
      } else {
        audioTracks.forEach((track) => {
          track.enabled = true;
        });
        setIsMuted(false);
      }
    }
  }, [inputMode]);

  // Global window key listeners for Push to Talk
  useEffect(() => {
    if (!channelId || inputMode !== 'push' || !socket) return;

    let isPressed = false;

    const handleKeyDown = (e) => {
      if (e.key === pttKey) {
        if (pttKey === 'CapsLock' || pttKey === ' ') {
          e.preventDefault();
        }
        if (!isPressed) {
          isPressed = true;
          console.log('[WebRTC PTT] Speaking...');
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = true;
            });
          }
          setIsMuted(false);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === pttKey) {
        isPressed = false;
        console.log('[WebRTC PTT] Muted...');
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        setIsMuted(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Restore mic track if inputMode changes or unmounts
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      setIsMuted(false);
    };
  }, [socket, channelId, inputMode, pttKey]);

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
    setRemoteCameraStates({});
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
      const nextState = !videoTracks[0]?.enabled;
      setIsCameraOff(nextState);
      localStorage.setItem('voice_camera_off', nextState ? 'true' : 'false');

      if (socketRef.current && channelIdRef.current) {
        socketRef.current.emit('update_camera_state', {
          channelId: channelIdRef.current,
          isCameraOff: nextState,
        });
      }
    }
  };

  const leaveChannel = () => {
    cleanupAll();
  };

  const [speakingUsers, setSpeakingUsers] = useState({});
  const audioContextRef = useRef(null);
  const analysersRef = useRef({}); // maps username -> { analyser, source, stream }

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const setupAudioAnalyser = (username, stream) => {
    try {
      if (!stream || stream.getAudioTracks().length === 0) return;
      
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      analysersRef.current[username] = {
        analyser,
        source,
        stream
      };
      console.log(`[WebRTC] Audio analyser setup complete for: ${username}`);
    } catch (err) {
      console.error(`Failed to setup audio analyser for ${username}:`, err);
    }
  };

  const removeAudioAnalyser = (username) => {
    const entry = analysersRef.current[username];
    if (entry) {
      try {
        entry.source.disconnect();
      } catch (err) {}
      delete analysersRef.current[username];
      console.log(`[WebRTC] Audio analyser removed for: ${username}`);
    }
  };

  // Periodically check who is speaking
  useEffect(() => {
    if (!channelId || !socket) {
      setSpeakingUsers({});
      return;
    }

    const interval = setInterval(() => {
      const currentSpeaking = {};
      const threshold = 8; // average volume threshold

      // 1. Analyze local stream
      if (localStreamRef.current && localUsername) {
        const username = localUsername;
        let entry = analysersRef.current[username];
        if (!entry || entry.stream !== localStreamRef.current) {
          if (entry) removeAudioAnalyser(username);
          setupAudioAnalyser(username, localStreamRef.current);
          entry = analysersRef.current[username];
        }

        if (entry && entry.analyser) {
          const bufferLength = entry.analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          entry.analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const isSpeaking = average > threshold;
          if (isSpeaking) {
            currentSpeaking[username] = true;
          }
        }
      }

      // 2. Analyze remote streams
      Object.keys(remoteStreams).forEach((peerSocketId) => {
        const username = peersInfo[peerSocketId];
        const stream = remoteStreams[peerSocketId];
        if (username && stream) {
          let entry = analysersRef.current[username];
          if (!entry || entry.stream !== stream) {
            if (entry) removeAudioAnalyser(username);
            setupAudioAnalyser(username, stream);
            entry = analysersRef.current[username];
          }

          if (entry && entry.analyser) {
            const bufferLength = entry.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            entry.analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const isSpeaking = average > threshold;
            if (isSpeaking) {
              currentSpeaking[username] = true;
            }
          }
        }
      });

      // Cleanup analysers for users that left
      const currentUsers = new Set();
      if (localUsername) currentUsers.add(localUsername);
      Object.keys(remoteStreams).forEach((peerSocketId) => {
        const username = peersInfo[peerSocketId];
        if (username) currentUsers.add(username);
      });

      Object.keys(analysersRef.current).forEach((username) => {
        if (!currentUsers.has(username)) {
          removeAudioAnalyser(username);
        }
      });

      setSpeakingUsers(currentSpeaking);
    }, 100);

    return () => {
      clearInterval(interval);
      Object.keys(analysersRef.current).forEach((username) => {
        removeAudioAnalyser(username);
      });
      setSpeakingUsers({});
    };
  }, [channelId, socket, remoteStreams, peersInfo, localUsername]);

  return {
    localStream,
    remoteStreams,
    peersInfo,
    remoteCameraStates,
    speakingUsers,
    isMuted,
    isCameraOff,
    toggleMic,
    toggleCamera,
    leaveChannel,
  };
};

export default useWebRTC;
