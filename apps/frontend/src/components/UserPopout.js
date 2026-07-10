import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import api, { API_BASE_URL } from '../services/api.js';
import { UserPlus, MoreHorizontal } from 'lucide-react';

export default function UserPopout({ userId, serverId, onClose, onEditProfile, isOnline, style, onFriendRequestSent }) {
  const { user } = useAuth();
  const currentUser = user;
  const isSelf = currentUser?.id === userId;

  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friendRequestStatus, setFriendRequestStatus] = useState(null);

  const popoutRef = useRef(null);

  const handleAddFriend = async () => {
    setFriendRequestStatus('sending');
    try {
      await api.post('/api/friends/request', { username: userData.username });
      setFriendRequestStatus('sent');
      if (onFriendRequestSent) {
        onFriendRequestSent();
      }
    } catch (err) {
      console.error('[UserPopout] Failed to send friend request:', err);
      const errMsg = err.response?.data?.error || 'Failed to send friend request.';
      alert(errMsg);
      setFriendRequestStatus('error');
    }
  };

  // Click outside to close listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Delay registration slightly to prevent instant closure on the click that opens it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onClose]);

  // Fetch user specific profile data
  useEffect(() => {
    let active = true;
    const fetchMemberData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/servers/${serverId}/members/${userId}`);
        if (active && response.data) {
          setUserData(response.data);
        }
      } catch (err) {
        console.error('[UserPopout] Failed to fetch member profile:', err);
        if (active) {
          setError(err.response?.data?.error || 'Failed to load user profile.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    if (serverId && userId) {
      fetchMemberData();
    }
    return () => {
      active = false;
    };
  }, [serverId, userId]);

  const getFullAvatarUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  // Skeleton Loader for Loading State
  if (isLoading) {
    return (
      <div
        ref={popoutRef}
        style={style}
        className="absolute z-[100] w-[340px] bg-[#232428] rounded-xl shadow-2xl overflow-hidden animate-pulse border border-gray-800/20"
      >
        <div className="h-[120px] bg-gray-700/50" />
        <div className="p-4 pt-12 relative bg-[#111214]">
          <div className="absolute top-[-40px] left-4 w-20 h-20 rounded-full border-[6px] border-[#232428] bg-gray-700/70" />
          <div className="h-6 bg-gray-700/60 rounded w-1/2 mb-3" />
          <div className="h-4 bg-gray-700/40 rounded w-1/3 mb-4" />
          <div className="border-b border-[#2B2D31] my-3" />
          <div className="h-3 bg-gray-700/30 rounded w-1/4 mb-2" />
          <div className="h-12 bg-gray-700/20 rounded w-full mb-4" />
          <div className="h-8 bg-gray-700/40 rounded w-full" />
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        ref={popoutRef}
        style={style}
        className="absolute z-[100] w-[340px] bg-[#232428] rounded-xl shadow-2xl p-5 text-center text-gray-300 border border-red-500/20 flex flex-col items-center gap-3"
      >
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button
          onClick={onClose}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded transition"
        >
          Close
        </button>
      </div>
    );
  }

  const avatarSrc = userData.avatarUrl
    ? getFullAvatarUrl(userData.avatarUrl)
    : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userData.username}`;

  let statusEmoji = '';
  let statusText = userData.customStatus || '';

  if (userData.customStatus) {
    const emojis = ['😊', '🐱', '🎮', '🚀', '🎉', '🔥', '💻', '🍕', '❤️', '🤔', '👍', '✨', '💖'];
    const foundEmoji = emojis.find(e => userData.customStatus.startsWith(e));
    if (foundEmoji) {
      statusEmoji = foundEmoji;
      statusText = userData.customStatus.slice(foundEmoji.length).trim();
    }
  }

  return (
    <div
      ref={popoutRef}
      style={style}
      className="absolute z-[100] w-[340px] bg-[#232428] rounded-xl shadow-2xl overflow-hidden border border-gray-800/10 text-left"
    >
      {/* Top Banner & Action Buttons */}
      <div className="relative select-none">
        <div
          className="h-[120px] w-full transition-colors"
          style={{ backgroundColor: userData.bannerColor || '#5865F2' }}
        />

        {/* Action icons (only if not self) */}
        {!isSelf && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={handleAddFriend}
              disabled={friendRequestStatus === 'sent' || friendRequestStatus === 'sending'}
              className={`p-1.5 rounded-md transition text-white
                ${friendRequestStatus === 'sent' 
                  ? 'bg-green-600 cursor-not-allowed' 
                  : friendRequestStatus === 'sending'
                    ? 'bg-gray-600 cursor-wait'
                    : 'bg-black/40 hover:bg-black/60'}`}
              title={friendRequestStatus === 'sent' ? 'Friend Request Sent' : 'Add Friend'}
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => alert('More actions is not implemented.')}
              className="bg-black/40 text-white p-1.5 rounded-md hover:bg-black/60 transition"
              title="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Avatar Container */}
        <div className="absolute top-[75px] left-4 w-20 h-20 rounded-full border-[6px] border-[#232428] bg-[#232428]">
          <img
            src={avatarSrc}
            alt={userData.username}
            className="w-full h-full rounded-full bg-slate-800 object-cover"
          />
          {/* Status Dot */}
          <div
            className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-[3px] border-[#232428]
              ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}
          />
        </div>

        {/* Custom Status Bubble overlapping avatar */}
        {userData.customStatus && (
          <div className="absolute top-[58px] left-[84px] z-20 max-w-[150px]">
            <div className="bg-[#111214] border-[3px] border-[#232428] rounded-xl px-2.5 py-1.5 flex items-start gap-1.5 shadow-md relative text-xs">
              {/* Little Tail fill / border */}
              <div className="absolute left-[-8px] top-[7px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-[#232428] z-0" />
              <div className="absolute left-[-5px] top-[8px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#111214] z-10" />
              
              {statusEmoji && <span className="text-xs flex-shrink-0 mt-0.5 z-10">{statusEmoji}</span>}
              <span className="text-xs text-white truncate block max-w-[90px] select-text z-10">
                {statusText}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Details Box Section */}
      <div className="bg-[#111214] m-4 mt-[50px] p-4 rounded-lg flex flex-col text-left">
        <h3 className="text-xl font-bold text-white leading-tight truncate select-all">
          {userData.displayName}
        </h3>
        <span className="text-sm text-gray-400 mb-3 select-all">@{userData.username}</span>

        <div className="border-t border-[#2B2D31] my-3" />

        {/* About Me */}
        {userData.aboutMe && (
          <div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap select-text leading-normal">
              {userData.aboutMe}
            </p>
          </div>
        )}

        {/* Action Footer */}
        {isSelf ? (
          <button
            onClick={() => {
              onClose();
              onEditProfile();
            }}
            className="w-full mt-4 bg-[#5865F2] hover:bg-[#4752C4] text-white py-1.5 rounded text-sm font-medium transition cursor-pointer select-none text-center"
          >
            Edit Profile
          </button>
        ) : (
          <div className="w-full mt-4 bg-[#1E1F22] border border-transparent focus-within:border-gray-500 rounded p-2.5 text-sm text-gray-200 flex items-center">
            <input
              type="text"
              placeholder={`Message @${userData.username}`}
              className="bg-transparent outline-none w-full text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  alert(`Direct Message to @${userData.username} is not implemented.`);
                  e.target.value = '';
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
