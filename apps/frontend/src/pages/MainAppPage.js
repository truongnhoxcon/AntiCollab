import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useChat } from '../context/ChatContext.js';
import logo2 from '../assets/AntiGR Logo 02.png';
import api from '../services/api.js';
import {
  Hash,
  Volume2,
  Mic,
  MicOff,
  Headphones,
  Settings,
  Plus,
  Compass,
  ChevronDown,
  Search,
  Bell,
  Pin,
  Users,
  HelpCircle,
  Smile,
  Gift,
  FileCode,
  MessageSquare,
  Sparkles,
  LogOut,
  Signal,
  X,
  ChevronRight,
  Camera,
  ImagePlus,
  User,
  Gamepad2,
  Heart,
  BookOpen,
  GraduationCap,
  Leaf,
  Palette,
  Gem,
  UserPlus,
  FolderPlus,
  CheckSquare,
  Shield,
  Edit2,
  Copy,
  PlusCircle,
  MoreVertical
} from 'lucide-react';

const templates = [
  {
    id: 'custom',
    title: 'Create My Own',
    channels: [{ type: 'text', name: 'general' }, { type: 'voice', name: 'General' }]
  },
  {
    id: 'gaming',
    title: 'Gaming',
    categories: [{ name: 'Text Channels', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'clips-and-highlights' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lobby' }, { type: 'voice', name: 'Gaming' }] }]
  },
  {
    id: 'friends',
    title: 'Friends',
    categories: [{ name: 'Text Channels', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'gaming' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lounge' }, { type: 'voice', name: 'Stream' }] }]
  },
  {
    id: 'study',
    title: 'Study Group',
    categories: [{ name: 'Information', channels: [{ type: 'text', name: 'welcome-and-rules' }, { type: 'text', name: 'notes-and-resources' }] }, { name: 'Text Channels', channels: [{ type: 'text', name: 'general' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lounge' }, { type: 'voice', name: 'Study Room 1' }, { type: 'voice', name: 'Study Room 2' }] }]
  },
  {
    id: 'club',
    title: 'School Club',
    categories: [{ name: 'Information', channels: [{ type: 'text', name: 'welcome-and-rules' }, { type: 'text', name: 'announcements' }, { type: 'text', name: 'resources' }] }, { name: 'Text Channels', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'meeting-plans' }, { type: 'text', name: 'off-topic' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lounge' }, { type: 'voice', name: 'Meeting Room' }] }]
  },
  {
    id: 'local',
    title: 'Local Community',
    categories: [{ name: 'Information', channels: [{ type: 'text', name: 'welcome-and-rules' }, { type: 'text', name: 'announcements' }] }, { name: 'Text Channels', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'meeting-plans' }, { type: 'text', name: 'off-topic' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lounge' }, { type: 'voice', name: 'Meeting Room' }] }]
  },
  {
    id: 'creators',
    title: 'Artists & Creators',
    categories: [{ name: 'Information', channels: [{ type: 'text', name: 'welcome-and-rules' }, { type: 'text', name: 'announcements' }] }, { name: 'Text Channels', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'events' }, { type: 'text', name: 'ideas-and-feedback' }] }, { name: 'Voice Channels', channels: [{ type: 'voice', name: 'Lounge' }, { type: 'voice', name: 'Community Hangout' }, { type: 'voice', name: 'Stream Room' }] }]
  }
];

const DUMMY_FRIENDS = [
  { id: '1', displayName: 'Alex Mercer', username: 'alex_mercer' },
  { id: '2', displayName: 'Sarah Connor', username: 'sconnor' },
  { id: '3', displayName: 'Bruce Wayne', username: 'batman' },
  { id: '4', displayName: 'Peter Parker', username: 'spidey' },
  { id: '5', displayName: 'Viet Nguyen', username: 'viet_dev' },
  { id: '6', displayName: 'Clark Kent', username: 'superman' },
];

export default function MainAppPage() {
  const { user, logout } = useAuth();
  const {
    servers,
    activeServerId,
    setActiveServerId,
    channels,
    activeChannelId,
    setActiveChannelId,
    messages,
    members,
    sendMessage,
    createServer,
    createChannel,
    fetchServers
  } = useChat();

  // Navigation / Collapse states
  const [collapseText, setCollapseText] = useState(false);
  const [collapseVoice, setCollapseVoice] = useState(false);
  const [connectedVoiceId, setConnectedVoiceId] = useState(null);
  const [showMembersList, setShowMembersList] = useState(true);

  // User peripheral states
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Chat input
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Modals visibility and fields
  const [showServerModal, setShowServerModal] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCommunity, setIsCommunity] = useState(false);
  const [serverName, setServerName] = useState('');
  const [iconPreview, setIconPreview] = useState(null);

  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelNameInput, setChannelNameInput] = useState('');
  const [channelTypeInput, setChannelTypeInput] = useState('text');

  // Server dropdown & Invite states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteLinkInput, setInviteLinkInput] = useState('');

  // DM and Friends states
  const [dms, setDms] = useState([]);
  const [isLoadingDms, setIsLoadingDms] = useState(false);
  const [friends, setFriends] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [activeTab, setActiveTab] = useState('online'); // 'online', 'all', 'pending', 'add-friend'
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [addFriendUsernameInput, setAddFriendUsernameInput] = useState('');
  const [addFriendMessage, setAddFriendMessage] = useState(null);
  const [addFriendError, setAddFriendError] = useState(null);

  // Settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [profileTab, setProfileTab] = useState('user'); // 'user' or 'server'
  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [bannerColor, setBannerColor] = useState('#5865F2');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const initialSettingsRef = useRef({
    displayName: '',
    pronouns: '',
    aboutMe: '',
    bannerColor: '#5865F2'
  });

  // Initialize profile values when settings modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      const initial = {
        displayName: displayName || user?.username || '',
        pronouns: pronouns || '',
        aboutMe: aboutMe || '',
        bannerColor: bannerColor || '#5865F2'
      };
      // Only set initial ref if it hasn't been set yet during this open session
      if (!initialSettingsRef.current.displayName && user?.username) {
        initialSettingsRef.current = {
          displayName: user.username,
          pronouns: '',
          aboutMe: '',
          bannerColor: '#5865F2'
        };
        setDisplayName(user.username);
        setPronouns('');
        setAboutMe('');
        setBannerColor('#5865F2');
      }
      setIsDirty(false);
    }
  }, [isSettingsOpen, user]);

  // Track profile form modifications
  useEffect(() => {
    if (isSettingsOpen) {
      const changed = displayName !== initialSettingsRef.current.displayName ||
                      pronouns !== initialSettingsRef.current.pronouns ||
                      aboutMe !== initialSettingsRef.current.aboutMe ||
                      bannerColor !== initialSettingsRef.current.bannerColor;
      setIsDirty(changed);
    }
  }, [displayName, pronouns, aboutMe, bannerColor, isSettingsOpen]);


  // Fetch DMs
  const fetchDMs = async () => {
    setIsLoadingDms(true);
    try {
      const response = await api.get('/api/users/me/dms');
      if (response.data && response.data.dms) {
        setDms(response.data.dms);
      }
    } catch (err) {
      console.error('Failed to fetch DMs:', err);
    } finally {
      setIsLoadingDms(false);
    }
  };

  // Fetch Friends
  const fetchFriends = async () => {
    setIsLoadingFriends(true);
    try {
      const response = await api.get(`/api/users/me/friends?status=${activeTab}`);
      if (response.data && response.data.friends) {
        setFriends(response.data.friends);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Fetch Activities
  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const response = await api.get('/api/users/me/activities');
      if (response.data && response.data.activities) {
        setActivities(response.data.activities);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (user && !activeServerId) {
      fetchDMs();
      fetchActivities();
    }
  }, [user, activeServerId]);

  useEffect(() => {
    if (user && !activeServerId && activeTab !== 'add-friend') {
      fetchFriends();
    }
  }, [user, activeServerId, activeTab]);

  // Handle ESC key to close User Settings modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  const handleAddFriendSubmit = async (e) => {
    e.preventDefault();
    if (!addFriendUsernameInput.trim()) return;
    setAddFriendMessage(null);
    setAddFriendError(null);
    try {
      const response = await api.post('/api/users/me/friends', {
        username: addFriendUsernameInput.trim()
      });
      if (response.data && response.data.success) {
        setAddFriendMessage(response.data.message);
        setAddFriendUsernameInput('');
        fetchFriends();
      }
    } catch (err) {
      console.error('Failed to add friend:', err);
      setAddFriendError(err.response?.data?.error || 'Failed to add friend. User may not exist.');
    }
  };

  const handleHideDM = async (dmUserId) => {
    try {
      await api.delete(`/api/users/me/dms/${dmUserId}`);
      fetchDMs();
    } catch (err) {
      console.error('Failed to hide DM:', err);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const getTemplateIcon = (id) => {
    switch (id) {
      case 'custom':
        return <ImagePlus className="w-5 h-5 text-[#5865F2]" />;
      case 'gaming':
        return <Gamepad2 className="w-5 h-5 text-[#5865F2]" />;
      case 'friends':
        return <Heart className="w-5 h-5 text-[#5865F2]" />;
      case 'study':
        return <BookOpen className="w-5 h-5 text-[#5865F2]" />;
      case 'club':
        return <GraduationCap className="w-5 h-5 text-[#5865F2]" />;
      case 'local':
        return <Leaf className="w-5 h-5 text-[#5865F2]" />;
      case 'creators':
        return <Palette className="w-5 h-5 text-[#5865F2]" />;
      default:
        return <Plus className="w-5 h-5 text-[#5865F2]" />;
    }
  };

  const getTemplateDefaultName = (template, username) => {
    const name = username || 'Viet';
    if (!template || template.id === 'custom') {
      return `${name}'s server`;
    }
    return `${name}'s ${template.title}`;
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    const defaultName = getTemplateDefaultName(template, user?.username);
    setServerName(defaultName);
    setStep(2);
  };

  const handleIconChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyLink = () => {
    const inviteUrl = `http://localhost:5173/invite/${activeServerId || 'abc123xyz'}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setInviteCopied(true);
        setTimeout(() => {
          setInviteCopied(false);
        }, 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
        setInviteCopied(true);
        setTimeout(() => {
          setInviteCopied(false);
        }, 2000);
      });
  };

  // Active objects helper
  const activeServer = servers.find(s => s.id === activeServerId) || null;
  const activeChannel = channels.find(c => c.id === activeChannelId) || null;

  // Scroll to bottom when messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleVoiceChannelClick = (channelId) => {
    if (connectedVoiceId === channelId) {
      setConnectedVoiceId(null);
    } else {
      setConnectedVoiceId(channelId);
    }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    // 1. Format payload
    const payload = {
      serverName: serverName.trim(),
      iconPreview,
      isCommunity,
      template: selectedTemplate ? {
        id: selectedTemplate.id,
        title: selectedTemplate.title,
        channels: selectedTemplate.channels,
        categories: selectedTemplate.categories
      } : null
    };

    // 2. Console log payload
    console.log('[Create Server Payload]:', JSON.stringify(payload, null, 2));

    // 3. Create Server on backend
    const res = await createServer(serverName.trim());
    if (res.success && res.server) {
      const createdServer = res.server;

      // Extract template channels
      const templateChannels = [];
      if (selectedTemplate) {
        if (selectedTemplate.channels) {
          templateChannels.push(...selectedTemplate.channels);
        } else if (selectedTemplate.categories) {
          selectedTemplate.categories.forEach(cat => {
            if (cat.channels) {
              templateChannels.push(...cat.channels);
            }
          });
        }
      }

      // 4. Sequentially create channels
      for (const chan of templateChannels) {
        try {
          await api.post(`/api/servers/${createdServer.id}/channels`, {
            name: chan.name,
            type: chan.type
          });
        } catch (err) {
          console.error(`Failed to create template channel ${chan.name}:`, err.message);
        }
      }

      // 5. Fetch updated server list and switch active server
      await fetchServers();
      setActiveServerId(createdServer.id);

      // Select the first text channel of the newly created server
      try {
        const updatedServerList = await api.get('/api/servers');
        const newlyFetchedServer = updatedServerList.data.find(s => s.id === createdServer.id);
        if (newlyFetchedServer) {
          const textChan = newlyFetchedServer.channels?.find(c => c.type === 'text');
          if (textChan) {
            setActiveChannelId(textChan.id);
          } else {
            setActiveChannelId(null);
          }
        }
      } catch (err) {
        console.error('Failed to auto-select first channel:', err.message);
      }
      
      // Reset states and close modal
      setStep(1);
      setSelectedTemplate(null);
      setIsCommunity(false);
      setServerName('');
      setIconPreview(null);
      setShowServerModal(false);
    } else {
      alert(`Error creating server: ${res.error || 'Unknown error'}`);
    }
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();
    if (!inviteLinkInput.trim()) return;

    try {
      const response = await api.post('/api/servers/join', {
        serverId: inviteLinkInput.trim()
      });
      const joinedServer = response.data.server;

      // Fetch updated list of servers from backend
      await fetchServers();

      // Select the joined server
      setActiveServerId(joinedServer.id);

      // Select its first text channel if any
      try {
        const updatedServerList = await api.get('/api/servers');
        const newlyFetchedServer = updatedServerList.data.find(s => s.id === joinedServer.id);
        if (newlyFetchedServer) {
          const textChan = newlyFetchedServer.channels?.find(c => c.type === 'text');
          if (textChan) {
            setActiveChannelId(textChan.id);
          } else {
            setActiveChannelId(null);
          }
        }
      } catch (err) {
        console.error('Failed to auto-select first channel:', err.message);
      }

      // Clear inputs and close modal
      setInviteLinkInput('');
      setShowServerModal(false);
      alert(response.data.message || 'Successfully joined server!');
    } catch (err) {
      console.error('Failed to join server:', err);
      alert(err.response?.data?.error || 'Failed to join server. Please check your link/ID.');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!channelNameInput.trim()) return;
    const res = await createChannel(channelNameInput, channelTypeInput);
    if (res.success) {
      setChannelNameInput('');
      setShowChannelModal(false);
    } else {
      alert(`Error creating channel: ${res.error}`);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#313338] text-gray-100 font-sans overflow-hidden select-none relative">

      {/* 1. SERVER SIDEBAR */}
      <aside className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 flex-shrink-0">
        {/* AntiGroup Home / Logo */}
        <div className="relative group flex items-center justify-center w-full">
          <div className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 
            ${!activeServerId ? 'h-10' : 'h-0 group-hover:h-5'}`}
          />
          <button
            onClick={() => {
              setActiveServerId(null);
              setActiveChannelId(null);
            }}
            className="w-12 h-12 rounded-2xl bg-[#5865F2] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <img src={logo2} alt="AntiGroup Home" className="w-10 h-10 object-contain rounded-2xl" />
          </button>
          <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
            AntiGroup Home
          </div>
        </div>

        {/* Divider */}
        <div className="w-8 h-[2px] bg-[#313338] my-1 rounded" />

        {/* Dynamic Server List */}
        <div className="flex-1 w-full flex flex-col gap-2 overflow-y-auto no-scrollbar">
          {servers.map((server) => {
            const isActive = server.id === activeServerId;
            return (
              <div key={server.id} className="relative group flex items-center justify-center w-full">
                <div className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 
                  ${isActive ? 'h-10' : 'h-0 group-hover:h-5'}`}
                />
                <button
                  onClick={() => {
                    setActiveServerId(server.id);
                    const firstChan = server.channels?.find(c => c.type === 'text');
                    if (firstChan) {
                      setActiveChannelId(firstChan.id);
                    } else {
                      setActiveChannelId(null);
                    }
                  }}
                  className={`w-12 h-12 flex items-center justify-center text-sm font-bold tracking-wide transition-all duration-200 
                    ${isActive
                      ? 'rounded-2xl bg-[#5865F2] text-white'
                      : 'rounded-[24px] bg-[#313338] text-gray-300 hover:rounded-2xl hover:bg-[#5865F2] hover:text-white'}`}
                >
                  {server.abbr || server.name.substring(0, 2).toUpperCase()}
                </button>
                <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                  {server.name}
                </div>
              </div>
            );
          })}

          {/* Add a Server Button */}
          <div className="relative group flex items-center justify-center w-full">
            <button
              onClick={() => {
                setStep(1);
                setSelectedTemplate(null);
                setIsCommunity(false);
                setServerName('');
                setIconPreview(null);
                setShowServerModal(true);
              }}
              className="w-12 h-12 rounded-[24px] bg-[#313338] text-emerald-500 hover:rounded-2xl hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <Plus className="w-6 h-6" />
            </button>
            <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Add a Server
            </div>
          </div>
        </div>
      </aside>

      {/* 2. CHANNELS SIDEBAR */}
      <aside className="w-60 bg-[#2B2D31] flex flex-col flex-shrink-0 relative" ref={dropdownRef}>
        {activeServerId ? (
          <>
            <header
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 font-bold text-white shadow-sm cursor-pointer hover:bg-[#35373C] transition relative"
            >
              <span className="truncate">{activeServer ? activeServer.name : 'No Server Selected'}</span>
              <ChevronDown className="w-5 h-5 text-gray-300" />
            </header>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-[48px] left-2 right-2 z-50 bg-[#111214] rounded-md shadow-lg p-1.5 border border-gray-950 flex flex-col gap-0.5 animate-fade-in text-xs font-semibold text-gray-300">
                <button
                  onClick={() => {
                    alert("Server Boosted!");
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#5865F2] hover:text-white text-fuchsia-400 transition text-left"
                >
                  <span>Server Boost</span>
                  <Gem className="w-4 h-4" />
                </button>

                <div className="border-t border-[#313338] my-1" />

                <button
                  onClick={() => {
                    setIsInviteModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#5865F2] hover:text-white text-[#5865F2] transition text-left"
                >
                  <span>Invite People</span>
                  <UserPlus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    alert("Server Settings is not implemented yet!");
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#5865F2] hover:text-white transition text-left"
                >
                  <span>Server Settings</span>
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setChannelTypeInput('text');
                    setShowChannelModal(true);
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#5865F2] hover:text-white transition text-left"
                >
                  <span>Create Channel</span>
                  <PlusCircle className="w-4 h-4" />
                </button>

                <div className="border-t border-[#313338] my-1" />

                <button
                  onClick={() => {
                    alert("Left server!");
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-[#5865F2] hover:text-white text-red-400 transition text-left"
                >
                  <span>Leave Server</span>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Channel Categories */}
            <div className="flex-1 overflow-y-auto pt-4 px-2 space-y-4">

              {/* TEXT CHANNELS */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1 py-1 hover:text-gray-200 cursor-pointer">
                  <button
                    onClick={() => setCollapseText(!collapseText)}
                    className="flex items-center gap-1 uppercase tracking-wider text-left"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${collapseText ? '-rotate-90' : ''}`} />
                    Text Channels
                  </button>
                  {activeServer && (
                    <Plus
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelTypeInput('text');
                        setShowChannelModal(true);
                      }}
                      className="w-4 h-4 hover:text-white"
                    />
                  )}
                </div>

                {!collapseText && activeServer && (
                  <div className="mt-1 space-y-[2px]">
                    {channels
                      .filter(c => c.type === 'text')
                      .map(c => {
                        const isSelected = c.id === activeChannelId;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setActiveChannelId(c.id)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition group text-left
                              ${isSelected
                                ? 'bg-[#3F4147] text-white'
                                : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                          >
                            <Hash className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{c.name}</span>
                          </button>
                        );
                      })
                    }
                  </div>
                )}
              </div>

              {/* VOICE CHANNELS */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1 py-1 hover:text-gray-200 cursor-pointer">
                  <button
                    onClick={() => setCollapseVoice(!collapseVoice)}
                    className="flex items-center gap-1 uppercase tracking-wider text-left"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${collapseVoice ? '-rotate-90' : ''}`} />
                    Voice Channels
                  </button>
                  {activeServer && (
                    <Plus
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelTypeInput('voice');
                        setShowChannelModal(true);
                      }}
                      className="w-4 h-4 hover:text-white"
                    />
                  )}
                </div>

                {!collapseVoice && activeServer && (
                  <div className="mt-1 space-y-[2px]">
                    {channels
                      .filter(c => c.type === 'voice')
                      .map(c => {
                        const isConnected = c.id === connectedVoiceId;
                        return (
                          <button
                            key={c.id}
                            onClick={() => handleVoiceChannelClick(c.id)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm font-medium transition group
                              ${isConnected
                                ? 'bg-[#3F4147] text-emerald-400'
                                : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Volume2 className={`w-5 h-5 flex-shrink-0 ${isConnected ? 'text-emerald-400' : 'text-gray-400'}`} />
                              <span className="truncate">{c.name}</span>
                            </div>
                            {isConnected && (
                              <span className="text-xs bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400">
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            </div>

            {/* VOICE CONNECTED STATUS BANNER */}
            {connectedVoiceId && activeServer && (
              <div className="bg-[#232428] border-b border-[#1E1F22] p-3 flex flex-col gap-1 text-white text-xs select-none">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Signal className="w-4 h-4 animate-pulse" />
                  <span>Voice Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 truncate">
                    {channels.find(c => c.id === connectedVoiceId)?.name} / {activeServer.name}
                  </span>
                  <button
                    onClick={() => setConnectedVoiceId(null)}
                    className="text-gray-400 hover:text-red-500 hover:bg-gray-800 p-1 rounded transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Direct Messages Sidebar */}
            <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-3 font-semibold text-white shadow-sm flex-shrink-0">
              <button
                onClick={() => setActiveTab('online')}
                className="w-full bg-[#1E1F22] hover:bg-[#35373C] text-gray-400 hover:text-gray-200 text-xs px-2 py-1.5 rounded transition flex items-center justify-between text-left border border-gray-900/40"
              >
                <span>Find or start a conversation</span>
              </button>
            </header>

            {/* DM Top Menu & DM List */}
            <div className="flex-1 overflow-y-auto pt-3 px-2 space-y-[2px] no-scrollbar">
              <button
                onClick={() => setActiveTab('online')}
                className={`w-full flex items-center gap-4 px-3 py-2 rounded text-sm font-semibold transition group text-left
                  ${activeTab !== 'add-friend' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span>Friends</span>
              </button>

              <button className="w-full flex items-center gap-4 px-3 py-2 rounded text-sm font-semibold transition text-gray-400 hover:bg-[#35373C] hover:text-gray-200 group text-left">
                <Sparkles className="w-5 h-5 text-[#5865F2] flex-shrink-0" />
                <span>Premium</span>
              </button>

              {/* DM List Header */}
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-3 pt-4 pb-1 uppercase tracking-wider select-none">
                <span>Direct Messages</span>
                <Plus className="w-4 h-4 hover:text-white cursor-pointer" onClick={() => setActiveTab('add-friend')} />
              </div>

              {/* DM List */}
              <div className="space-y-[2px]">
                {isLoadingDms ? (
                  <div className="space-y-2 px-3 py-2">
                    <div className="h-8 bg-gray-700/30 animate-pulse rounded" />
                    <div className="h-8 bg-gray-700/30 animate-pulse rounded" />
                    <div className="h-8 bg-gray-700/30 animate-pulse rounded" />
                  </div>
                ) : dms.length === 0 ? (
                  <p className="text-xs text-gray-500 italic px-3 py-2 select-none">No active conversations</p>
                ) : (
                  dms.map((dm) => (
                    <div
                      key={dm.id}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded text-sm font-semibold transition text-gray-400 hover:bg-[#35373C] hover:text-gray-200 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${dm.user?.username}`}
                          alt="Avatar"
                          className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0"
                        />
                        <span className="truncate text-gray-200 group-hover:text-white">{dm.user?.username}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideDM(dm.dmUserId);
                        }}
                        className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* BOTTOM USER PANEL */}
        <footer className="h-[52px] bg-[#232428] flex items-center justify-between px-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 max-w-[120px] cursor-pointer p-1 rounded hover:bg-[#35373C] transition">
            <div className="relative">
              <img
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.username || 'You'}`}
                alt="Avatar"
                className="w-8 h-8 rounded-full bg-slate-800"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#232428]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white leading-tight truncate">{user?.username || 'AntiUser'}</span>
              <span className="text-[10px] text-gray-400 leading-none truncate">#{user?.id ? user.id.substring(0, 4) : '1337'}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center text-gray-400 gap-0.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition ${isMuted ? 'text-red-500' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                const nextDeafen = !isDeafened;
                setIsDeafened(nextDeafen);
                if (nextDeafen) setIsMuted(true);
              }}
              className={`p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition ${isDeafened ? 'text-red-500' : ''}`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition"
              title="User Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </aside>

      {/* 3. CENTER PANEL (CHAT OR FRIENDS) */}
      {activeServerId ? (
        <main className="flex-1 bg-[#313338] flex flex-col min-w-0">
          {/* Header Bar */}
          <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-white">
              <Hash className="w-6 h-6 text-gray-400" />
              <span>{activeChannel ? activeChannel.name : 'select-a-channel'}</span>
            </div>

            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-1">
                <button className="p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition">
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button className="p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition">
                  <Pin className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowMembersList(!showMembersList)}
                  className={`p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition ${showMembersList ? 'text-white bg-[#3F4147]' : ''}`}
                >
                  <Users className="w-5 h-5" />
                </button>
              </div>

              {/* Mock Search Bar */}
              <div className="relative bg-[#1E1F22] rounded flex items-center px-2 py-1 gap-1 text-xs">
                <input
                  type="text"
                  placeholder="Search"
                  className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 w-36 focus:w-48 transition-all duration-150"
                />
                <Search className="w-4 h-4 text-gray-500" />
              </div>

              <button className="p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="mb-6 border-b border-gray-700/30 pb-6">
              <div className="w-16 h-16 rounded-full bg-[#3F4147] flex items-center justify-center text-white mb-4">
                <Hash className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-black text-white mb-1">
                Welcome to #{activeChannel ? activeChannel.name : 'lounge'}!
              </h1>
              <p className="text-gray-400 text-sm">
                This is the start of the #{activeChannel ? activeChannel.name : 'lounge'} channel history.
              </p>
            </div>

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-4 group hover:bg-[#2e3035] -mx-4 px-4 py-1.5 transition duration-100">
                <img
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${msg.sender?.username || 'You'}`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-white hover:underline cursor-pointer">
                      {msg.sender?.username || 'You'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mt-1 select-text leading-relaxed break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          {activeChannel && (
            <form onSubmit={handleSendMessage} className="px-4 pb-6 flex-shrink-0">
              <div className="bg-[#383A40] rounded-lg p-2.5 flex items-center gap-3">
                <button
                  type="button"
                  className="p-1 text-gray-400 hover:text-gray-200 bg-[#4E5058] rounded-full hover:bg-gray-600 transition flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 text-[#313338]" strokeWidth={3} />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message #` + activeChannel.name}
                  className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 text-sm flex-1"
                />
                <div className="flex items-center gap-2 text-gray-400">
                  <button type="button" className="p-1 hover:text-gray-200 transition">
                    <Gift className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-1 hover:text-gray-200 transition">
                    <FileCode className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-1 hover:text-gray-200 transition">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </main>
      ) : (
        // Friends Page Content
        <main className="flex-1 bg-[#313338] flex flex-col min-w-0">
          {/* Top Navbar */}
          <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 flex-shrink-0 shadow-sm select-none">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-200">Friends</span>

              {/* Vertical Divider */}
              <div className="w-[1px] h-4 bg-gray-700 mx-2" />

              {/* Tabs */}
              <div className="flex items-center gap-2.5 text-sm">
                <button
                  onClick={() => setActiveTab('online')}
                  className={`px-3 py-1 rounded transition text-xs font-bold
                    ${activeTab === 'online' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                >
                  Online
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded transition text-xs font-bold
                    ${activeTab === 'all' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-3 py-1 rounded transition relative text-xs font-bold
                    ${activeTab === 'pending' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                >
                  Pending
                  {friends.filter(f => f.friendStatus === 'pending').length > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {friends.filter(f => f.friendStatus === 'pending').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('add-friend')}
                  className={`px-3 py-1 rounded font-bold text-xs transition
                    ${activeTab === 'add-friend' ? 'bg-transparent text-emerald-400' : 'bg-[#248046] text-white hover:bg-[#1f6b3a]'}`}
                >
                  Add Friend
                </button>
              </div>
            </div>
          </header>

          {/* Friends Content */}
          {activeTab === 'add-friend' ? (
            <div className="flex-1 p-6 flex flex-col max-w-xl">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-1.5">Add Friend</h2>
              <p className="text-gray-400 text-xs mb-4">You can add friends with their AntiGroup username.</p>
              
              <form onSubmit={handleAddFriendSubmit} className="relative bg-[#1E1F22] rounded-lg p-3 border border-gray-950 focus-within:border-[#5865F2] flex items-center justify-between">
                <input
                  type="text"
                  required
                  value={addFriendUsernameInput}
                  onChange={(e) => setAddFriendUsernameInput(e.target.value)}
                  placeholder="You can add friends with their AntiGroup username"
                  className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 text-sm w-full mr-2"
                />
                <button
                  type="submit"
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold px-4 py-2 rounded transition flex-shrink-0"
                >
                  Send Friend Request
                </button>
              </form>

              {addFriendMessage && (
                <p className="text-emerald-500 text-xs font-semibold mt-3">{addFriendMessage}</p>
              )}
              {addFriendError && (
                <p className="text-red-500 text-xs font-semibold mt-3">{addFriendError}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar">
              {/* Search input for friends list */}
              <div className="relative bg-[#1E1F22] rounded flex items-center px-3 py-2 gap-2 text-sm mb-4 border border-gray-900/40">
                <input
                  type="text"
                  placeholder="Search"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 w-full text-xs"
                />
                <Search className="w-4 h-4 text-gray-500" />
              </div>

              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 select-none">
                {activeTab === 'online' ? 'Online' : activeTab === 'pending' ? 'Pending' : 'All Friends'} — {
                  friends.filter(f => {
                    if (!friendSearchQuery.trim()) return true;
                    return f.username.toLowerCase().includes(friendSearchQuery.toLowerCase());
                  }).length
                }
              </div>

              {/* Friends list rows */}
              <div className="space-y-0.5">
                {isLoadingFriends ? (
                  <div className="space-y-3 py-1">
                    <div className="h-12 bg-gray-800/20 animate-pulse rounded" />
                    <div className="h-12 bg-gray-800/20 animate-pulse rounded" />
                    <div className="h-12 bg-gray-800/20 animate-pulse rounded" />
                  </div>
                ) : friends.filter(f => {
                  if (!friendSearchQuery.trim()) return true;
                  return f.username.toLowerCase().includes(friendSearchQuery.toLowerCase());
                }).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                    <p className="text-gray-400 text-sm font-semibold">No friends found.</p>
                    <p className="text-gray-500 text-xs mt-1">Try changing tabs or adding a friend!</p>
                  </div>
                ) : (
                  friends
                    .filter(f => {
                      if (!friendSearchQuery.trim()) return true;
                      return f.username.toLowerCase().includes(friendSearchQuery.toLowerCase());
                    })
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-[#3F4147]/40 border-t border-gray-800/10 group transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${friend.username}`}
                              alt="Avatar"
                              className="w-9 h-9 rounded-full bg-slate-800"
                            />
                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#313338]
                              ${friend.status === 'online' ? 'bg-emerald-500' : 'bg-gray-500'}`}
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-white truncate">
                              {friend.username}
                            </span>
                            <span className="text-[11px] text-gray-400 truncate">
                              {friend.customStatus}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <button
                            onClick={async () => {
                              try {
                                await api.post('/api/users/me/dms', { dmUserId: friend.id });
                                fetchDMs();
                                alert(`Opening DM conversation with ${friend.username}`);
                              } catch (err) {
                                console.error('Failed to open DM:', err);
                              }
                            }}
                            className="p-2 bg-[#2B2D31] hover:bg-black/50 text-gray-300 hover:text-white rounded-full transition"
                            title="Message"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button className="p-2 bg-[#2B2D31] hover:bg-black/50 text-gray-300 hover:text-white rounded-full transition" title="More Options">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* 4. ACTIVE MEMBERS SIDEBAR (Right) */}
      {activeServerId ? (
        showMembersList && activeServer && (
          <aside className="w-60 bg-[#2B2D31] border-l border-[#1E1F22] flex flex-col flex-shrink-0 p-4 overflow-y-auto select-none">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Members — {members.length}
            </h3>
            <div className="space-y-2">
              {members.map((member) => {
                const isOnline = member.status === 'online';
                return (
                  <div key={member.id} className="flex items-center gap-2.5 p-1.5 rounded hover:bg-[#35373C] cursor-pointer transition">
                    <div className="relative flex-shrink-0">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.username}`}
                        alt={member.username}
                        className="w-8 h-8 rounded-full bg-slate-800"
                      />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#2B2D31] 
                        ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`}
                      />
                    </div>
                    <span className={`text-sm font-semibold truncate ${isOnline ? 'text-gray-100' : 'text-gray-400'}`}>
                      {member.username}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        )
      ) : (
        // Active Now Sidebar for Home tab
        <aside className="w-[360px] bg-[#2B2D31] border-l border-[#1E1F22] flex flex-col flex-shrink-0 p-4 overflow-y-auto select-none hidden lg:flex">
          <h3 className="text-sm font-black text-white mb-4">Active Now</h3>
          
          <div className="space-y-3">
            {isLoadingActivities ? (
              <div className="space-y-3">
                <div className="h-24 bg-gray-800/20 animate-pulse rounded-lg" />
                <div className="h-24 bg-gray-800/20 animate-pulse rounded-lg" />
              </div>
            ) : activities.length === 0 ? (
              <div className="bg-[#313338]/50 rounded-lg p-4 text-center border border-gray-800/10 select-none">
                <p className="text-gray-400 text-xs font-semibold">It's quiet for now...</p>
                <p className="text-gray-500 text-[11px] mt-1 leading-normal">
                  When a friend starts an activity—like playing a game or listening to music—we'll show it here!
                </p>
              </div>
            ) : (
              activities.map((act, idx) => (
                <div key={idx} className="bg-[#313338] border border-gray-800/20 rounded-lg p-3 hover:bg-[#3F4147]/20 transition cursor-pointer">
                  <div className="flex items-center gap-3 mb-2.5">
                    <img
                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${act.user?.username}`}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full bg-slate-800"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-200 truncate">{act.user?.username}</span>
                      <span className="text-[10px] text-gray-400 leading-none">Playing</span>
                    </div>
                  </div>
                  <div className="flex flex-col pl-1 border-l-2 border-[#5865F2] ml-4">
                    <span className="text-xs font-bold text-gray-200 leading-snug">{act.name}</span>
                    <span className="text-[11px] text-gray-400 leading-tight mt-0.5">{act.details}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* 5. CREATE SERVER MODAL */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-[480px] max-w-full bg-[#313338] rounded-lg shadow-2xl overflow-hidden relative border border-gray-800/80 animate-fade-in flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => setShowServerModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-100 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step 1: Template Selection */}
            {step === 1 && (
              <div className="flex flex-col h-full">
                <div className="p-6 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Create Your Server</h2>
                  <p className="text-sm text-gray-400">
                    Your server is where you and your friends hang out. Make yours and start talking.
                  </p>
                </div>
                
                <div className="px-6 py-2 overflow-y-auto max-h-[320px] space-y-2.5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-[#2B2D31] hover:bg-[#3F4147] transition border border-gray-800/20 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#313338] rounded-full group-hover:bg-[#2B2D31] transition flex items-center justify-center">
                          {getTemplateIcon(tpl.id)}
                        </div>
                        <span className="text-sm font-bold text-gray-200 group-hover:text-white">
                          {tpl.title}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-200 transition" />
                    </button>
                  ))}
                </div>

                <div className="p-6 bg-[#2B2D31] mt-auto flex flex-col items-center gap-3">
                  <span className="text-sm text-gray-400 font-medium">Have an invite already?</span>
                  <button
                    onClick={() => {
                      setStep(4);
                      setInviteLinkInput('');
                    }}
                    className="w-full bg-[#4E5058] hover:bg-[#6D6F78] text-white font-bold py-2.5 px-4 rounded transition text-sm"
                  >
                    Join a Server
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Tell Us More (Community Flag) */}
            {step === 2 && (
              <div className="flex flex-col h-full">
                <div className="p-6 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Tell us more about your server</h2>
                  <p className="text-sm text-gray-400 font-medium">
                    In order to help you with your setup, is your new server for just a few friends or a larger community?
                  </p>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <button
                    onClick={() => {
                      setIsCommunity(false);
                      setStep(3);
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-lg bg-[#2B2D31] hover:bg-[#3F4147] transition border border-gray-800/20 group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-[#313338] rounded-full group-hover:bg-[#2B2D31] transition flex items-center justify-center">
                        <User className="w-6 h-6 text-[#5865F2]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-white">For me and my friends</h4>
                        <p className="text-xs text-gray-400 group-hover:text-gray-300">A small group to hang out, share, and talk.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-200 transition" />
                  </button>

                  <button
                    onClick={() => {
                      setIsCommunity(true);
                      setStep(3);
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-lg bg-[#2B2D31] hover:bg-[#3F4147] transition border border-gray-800/20 group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-[#313338] rounded-full group-hover:bg-[#2B2D31] transition flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#5865F2]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-white">For a club or community</h4>
                        <p className="text-xs text-gray-400 group-hover:text-gray-300">A structured space for members, events, and moderation.</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-200 transition" />
                  </button>

                  <div className="text-center mt-6">
                    <button
                      onClick={() => {
                        setIsCommunity(false);
                        setStep(3);
                      }}
                      className="text-gray-400 hover:text-white text-xs font-semibold underline transition"
                    >
                      Not sure? You can skip this question for now.
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-[#2B2D31] mt-auto flex justify-between items-center">
                  <button
                    onClick={() => setStep(1)}
                    className="text-gray-200 hover:underline text-sm font-medium"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Customize Your Server */}
            {step === 3 && (
              <form onSubmit={handleCreateServer} className="flex flex-col h-full">
                <div className="p-6 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Customize Your Server</h2>
                  <p className="text-sm text-gray-400">
                    Give your new server a personality with a name and an icon. You can always change it later.
                  </p>
                </div>

                <div className="px-6 py-4 flex flex-col items-center">
                  {/* Circular Image Upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleIconChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[80px] h-[80px] rounded-full cursor-pointer relative group flex flex-col items-center justify-center transition overflow-visible"
                  >
                    {iconPreview ? (
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#5865F2]">
                        <img src={iconPreview} alt="Server Icon Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-full border-2 border-dashed border-gray-400 flex flex-col items-center justify-center hover:border-[#5865F2] bg-[#2B2D31] transition">
                        <Camera className="w-5 h-5 text-gray-400 group-hover:text-white mb-0.5" />
                        <span className="text-[9px] font-bold text-gray-400 group-hover:text-white uppercase">UPLOAD</span>
                        <div className="absolute top-0 right-0 bg-[#5865F2] text-white rounded-full p-1 translate-x-[20%] -translate-y-[20%] shadow-lg">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-400 mt-2 text-center">
                    Minimum size 128x128. Crop to a multiple of 128.
                  </span>

                  {/* Server Name Field */}
                  <div className="w-full mt-6">
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                      SERVER NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. My Study Group"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-gray-800 rounded-md p-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-[#5865F2] focus:border-transparent transition"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 mt-3 w-full text-left">
                    By creating a server, you agree to AntiGroup's{' '}
                    <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-500 hover:underline font-semibold">
                      Community Guidelines
                    </a>.
                  </p>
                </div>

                <div className="p-6 bg-[#2B2D31] mt-auto flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-gray-200 hover:underline text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2.5 px-6 rounded transition text-sm shadow-md"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Join a Server */}
            {step === 4 && (
              <form onSubmit={handleJoinServer} className="flex flex-col h-full">
                <div className="p-6 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Join a Server</h2>
                  <p className="text-sm text-gray-400">
                    Enter an invite link or invite ID below to join an existing server.
                  </p>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                      INVITE LINK OR SERVER ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. http://localhost:5173/invite/abc123xyz"
                      value={inviteLinkInput}
                      onChange={(e) => setInviteLinkInput(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-gray-800 rounded-md p-3 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-[#5865F2] focus:border-transparent transition"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Invites should look like:
                    </span>
                    <ul className="text-xs text-gray-400 space-y-1 font-medium list-disc list-inside">
                      <li><code className="text-gray-200">http://localhost:5173/invite/abc123xyz</code></li>
                      <li><code className="text-gray-200">abc123xyz</code> (for fallback demo join)</li>
                      <li><code className="text-gray-200">a9c512d7-b50a-4841-a1b9-dcd54d9241b3</code> (Server UUID)</li>
                    </ul>
                  </div>
                </div>

                <div className="p-6 bg-[#2B2D31] mt-auto flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-gray-200 hover:underline text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2.5 px-6 rounded transition text-sm shadow-md"
                  >
                    Join Server
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. CREATE CHANNEL MODAL */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#313338] rounded-md shadow-2xl p-6 relative border border-gray-800 animate-fade-in">
            <button
              onClick={() => setShowChannelModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-center text-white mb-2">Create Channel</h2>
            <p className="text-sm text-gray-400 text-center mb-6">
              Channels are where your members communicate. Add text or voice channels.
            </p>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. support-help"
                  value={channelNameInput}
                  onChange={(e) => setChannelNameInput(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-gray-800 rounded p-3 text-sm text-gray-100 outline-none focus:border-[#5865F2]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Channel Type
                </label>
                <select
                  value={channelTypeInput}
                  onChange={(e) => setChannelTypeInput(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-gray-800 rounded p-3 text-sm text-gray-100 outline-none focus:border-[#5865F2]"
                >
                  <option value="text">Text Channel</option>
                  <option value="voice">Voice Channel</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded transition"
              >
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. INVITE FRIENDS MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-[440px] max-w-full bg-[#313338] rounded-lg shadow-2xl relative border border-gray-800 animate-fade-in flex flex-col p-5">
            
            {/* Close Button */}
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white leading-tight">
                Invite friends to {activeServer ? activeServer.name : 'AntiGroup'}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                They'll arrive in <span className="font-semibold text-gray-300">#general</span>
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative bg-[#1E1F22] rounded flex items-center px-3 py-2 gap-2 text-sm mb-4 border border-gray-800 focus-within:ring-2 focus-within:ring-[#5865F2] transition">
              <input
                type="text"
                placeholder="Search for friends"
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 w-full text-xs"
              />
              <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </div>

            {/* Friend List (Scrollable Area) */}
            <div className="h-48 overflow-y-auto pr-1 space-y-2 mb-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {DUMMY_FRIENDS.filter((friend) => {
                if (!inviteSearchQuery.trim()) return true;
                const query = inviteSearchQuery.toLowerCase();
                return (
                  friend.displayName.toLowerCase().includes(query) ||
                  friend.username.toLowerCase().includes(query)
                );
              }).map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-2 rounded hover:bg-[#3F4147]/50 transition group">
                  <div className="flex items-center gap-3">
                    {/* Avatar circle placeholder */}
                    <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {friend.displayName.substring(0, 1)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-100 truncate group-hover:text-white leading-tight">
                        {friend.displayName}
                      </span>
                      <span className="text-[11px] text-gray-400 truncate leading-none">
                        @{friend.username}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      alert(`Invitation sent to ${friend.displayName}!`);
                    }}
                    className="border border-green-600 text-green-500 hover:bg-green-600 hover:text-white px-4 py-1 rounded-sm text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>

            {/* Footer invite link copier */}
            <div className="border-t border-[#2B2D31] pt-3">
              <span className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2">
                Or, send a server invite link to a friend
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`http://localhost:5173/invite/${activeServerId || 'abc123xyz'}`}
                  className="bg-[#1E1F22] text-gray-300 text-xs rounded p-2.5 outline-none flex-1 border border-gray-800"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded text-xs font-semibold transition-colors flex-shrink-0 font-medium"
                >
                  {inviteCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 8. USER SETTINGS OVERLAY */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 text-gray-100 font-sans">
          
          {/* Modal Container */}
          <div className="w-[1040px] max-w-[95vw] h-[80vh] bg-[#313338] rounded-xl shadow-2xl flex relative overflow-hidden animate-fade-in">
            
            {/* Left Sidebar Menu */}
            <aside className="w-[280px] flex-shrink-0 bg-[#2B2D31] pt-14 px-4 select-none overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                
                {/* Mini Profile Card */}
                <div
                  onClick={() => setSettingsTab('profiles')}
                  className="bg-[#1E1F22] hover:bg-[#2B2D31] cursor-pointer rounded-md p-2 flex items-center gap-3 mb-4 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-500 overflow-hidden flex-shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarSeed || user?.username || 'You'}`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-white font-bold text-sm truncate">{user?.username}</span>
                    <span className="text-gray-400 text-xs flex items-center gap-1 mt-0.5 font-medium">
                      Sửa Hồ Sơ
                      <Edit2 size={12} className="text-gray-400" />
                    </span>
                  </div>
                </div>

                {/* USER SETTINGS GROUP */}
                <div>
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-2.5 pb-1.5">User Settings</h3>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setSettingsTab('account')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'account' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      My Account
                    </button>
                    <button
                      onClick={() => setSettingsTab('profiles')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'profiles' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Profiles
                    </button>
                    <button
                      onClick={() => setSettingsTab('privacy')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'privacy' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Privacy & Safety
                    </button>
                  </div>
                </div>

                {/* APP SETTINGS GROUP */}
                <div>
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-2.5 pb-1.5">App Settings</h3>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setSettingsTab('appearance')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'appearance' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Appearance
                    </button>
                    <button
                      onClick={() => setSettingsTab('voice')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'voice' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Voice & Video
                    </button>
                    <button
                      onClick={() => setSettingsTab('notifications')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'notifications' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Notifications
                    </button>
                    <button
                      onClick={() => setSettingsTab('language')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold transition
                        ${settingsTab === 'language' ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}
                    >
                      Language
                    </button>
                  </div>
                </div>

                <div className="border-b border-[#1E1F22] my-2" />

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold text-red-500 hover:bg-red-500/10 transition"
                >
                  Log Out
                </button>
              </div>
            </aside>

            {/* Right Main Content Area */}
            <div className="flex-1 bg-[#313338] relative overflow-hidden flex flex-col">
              
              {/* Close Button (X / ESC) */}
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-6 right-6 flex flex-col items-center justify-center text-gray-400 hover:text-gray-200 cursor-pointer z-40"
              >
                <div className="w-9 h-9 rounded-full border-2 border-current flex items-center justify-center mb-1 transition duration-150">
                  <X className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-bold uppercase select-none">ESC</span>
              </button>

              <div className="flex-grow py-14 px-10 overflow-y-auto custom-scrollbar pb-28">
                <div className="max-w-3xl w-full">
                {settingsTab === 'account' ? (
                  // My Account View
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">My Account</h2>
                    
                    {/* Profile Card */}
                    <div className="bg-[#1E1F22] rounded-xl overflow-hidden shadow-lg">
                      {/* Banner */}
                      <div className="h-24 bg-[#5865F2] relative">
                        {/* Overlapping Avatar */}
                        <div className="absolute left-4 bottom-0 translate-y-1/2 group cursor-pointer">
                          <div className="relative">
                            <img
                              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.username || 'You'}`}
                              alt="Avatar"
                              className="w-20 h-20 rounded-full border-[6px] border-[#1E1F22] bg-[#2B2D31] object-cover"
                            />
                            {/* Edit Overlay */}
                            <div className="absolute inset-[6px] rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white">
                              EDIT
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile Card User Info */}
                      <div className="bg-[#2B2D31] p-4 pt-12 flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-base font-bold text-white leading-tight truncate">{user?.username}</span>
                          <span className="text-xs text-gray-400 truncate">@{user?.username?.toLowerCase()}</span>
                        </div>
                        <button
                          onClick={() => alert('Editing profile is a placeholder action.')}
                          className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold px-4 py-2 rounded transition flex-shrink-0"
                        >
                          Edit User Profile
                        </button>
                      </div>
                    </div>

                    {/* Account Details Container */}
                    <div className="bg-[#2B2D31] p-4 rounded-xl mt-6 space-y-5 border border-gray-800/10">
                      
                      {/* Display Name Row */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Display Name</span>
                          <span className="text-sm font-semibold text-white truncate">{user?.username}</span>
                        </div>
                        <button
                          onClick={() => alert('Editing field is not implemented in this demo.')}
                          className="bg-[#4E5058] hover:bg-[#6D6F78] text-white text-xs font-bold px-3 py-1.5 rounded transition flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Username Row */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Username</span>
                          <span className="text-sm font-semibold text-white truncate">@{user?.username?.toLowerCase()}</span>
                        </div>
                        <button
                          onClick={() => alert('Editing field is not implemented in this demo.')}
                          className="bg-[#4E5058] hover:bg-[#6D6F78] text-white text-xs font-bold px-3 py-1.5 rounded transition flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Email Row */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Email</span>
                          <span className="text-sm font-semibold text-white truncate">
                            {user?.email ? (
                              (() => {
                                const [name, domain] = user.email.split('@');
                                if (!domain) return user.email;
                                return `${name[0]}******${name[name.length - 1] || ''}@${domain}`;
                              })()
                            ) : 'No email address added'}
                          </span>
                        </div>
                        <button
                          onClick={() => alert('Editing field is not implemented in this demo.')}
                          className="bg-[#4E5058] hover:bg-[#6D6F78] text-white text-xs font-bold px-3 py-1.5 rounded transition flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Phone Number Row */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Phone Number</span>
                          <span className="text-sm font-semibold text-white truncate">You haven't added a phone number yet.</span>
                        </div>
                        <button
                          onClick={() => alert('Editing field is not implemented in this demo.')}
                          className="bg-[#4E5058] hover:bg-[#6D6F78] text-white text-xs font-bold px-3 py-1.5 rounded transition flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Password and Authentication */}
                    <div className="border-t border-[#1E1F22] mt-6 pt-6">
                      <h3 className="text-base font-bold text-white mb-2">Password and Authentication</h3>
                      <button
                        onClick={() => alert('Password modification is not supported in this mock interface.')}
                        className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold px-4 py-2 rounded transition shadow-md"
                      >
                        Change Password
                      </button>
                    </div>

                  </div>

                ) : settingsTab === 'profiles' ? (
                  // Profiles View
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Profiles</h2>
                    
                    {/* Sub-tabs (User vs Server) */}
                    <div className="relative border-b border-[#1E1F22] flex gap-6 mb-6">
                      <button
                        onClick={() => setProfileTab('user')}
                        className={`font-semibold pb-4 border-b-2 transition-colors text-sm focus:outline-none
                          ${profileTab === 'user' ? 'border-[#5865F2] text-white' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                      >
                        User Profile
                      </button>
                      <button
                        onClick={() => setProfileTab('server')}
                        className={`font-semibold pb-4 border-b-2 transition-colors text-sm focus:outline-none
                          ${profileTab === 'server' ? 'border-[#5865F2] text-white' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                      >
                        Server Profiles
                      </button>
                    </div>

                    {profileTab === 'server' ? (
                      <div className="py-10 text-gray-400 text-sm">
                        Server-specific profiles coming soon.
                      </div>
                    ) : (
                      // User Profile Form and Preview
                      <div className="flex flex-col lg:flex-row gap-8 mt-6">
                        {/* Left Column: Form Controls */}
                        <div className="flex-1 space-y-6">
                          
                          {/* Display Name */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Display Name</label>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder={user?.username || "YUTO"}
                              className="bg-[#1E1F22] text-gray-200 rounded p-2.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Pronouns */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pronouns</label>
                            <input
                              type="text"
                              value={pronouns}
                              onChange={(e) => setPronouns(e.target.value)}
                              placeholder="They/Them"
                              className="bg-[#1E1F22] text-gray-200 rounded p-2.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Avatar Section */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Avatar</label>
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                onClick={() => {
                                  const seed = prompt("Enter a seed name/username to customize your avatar:", avatarSeed || user?.username || "");
                                  if (seed !== null) setAvatarSeed(seed);
                                }}
                                className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold px-4 py-2 rounded transition"
                              >
                                Change Avatar
                              </button>
                              <button
                                onClick={() => setAvatarSeed("default")}
                                className="text-white hover:underline text-xs font-semibold px-4 py-2 transition bg-transparent"
                              >
                                Remove Avatar
                              </button>
                            </div>
                          </div>

                          {/* Banner Color */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Banner Color</label>
                            <div className="flex items-center gap-3">
                              <label
                                className="relative w-12 h-12 rounded cursor-pointer border border-gray-700/50 shadow-inner flex items-center justify-center transition hover:opacity-90"
                                style={{ backgroundColor: bannerColor }}
                              >
                                <input
                                  type="color"
                                  value={bannerColor}
                                  onChange={(e) => setBannerColor(e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <span className="text-white bg-black/40 p-1 rounded-full">
                                  {/* Pencil icon */}
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </span>
                              </label>
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">{bannerColor}</span>
                            </div>
                          </div>

                          {/* About Me */}
                          <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">About Me</label>
                            <textarea
                              value={aboutMe}
                              onChange={(e) => {
                                if (e.target.value.length <= 190) {
                                  setAboutMe(e.target.value);
                                }
                              }}
                              placeholder="Tell us about yourself..."
                              className="bg-[#1E1F22] text-gray-200 rounded p-2.5 w-full h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            />
                            <div className="text-[10px] text-gray-400 text-right mt-1">
                              {aboutMe.length}/190
                            </div>
                          </div>

                        </div>

                        {/* Right Column: Live Preview Card */}
                        <div className="w-[340px] flex-shrink-0">
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Preview</label>
                          
                          {/* Card Container */}
                          <div className="bg-[#232428] rounded-2xl overflow-hidden shadow-xl relative text-left">
                            
                            {/* Banner */}
                            <div
                              className="h-[120px] w-full transition-colors duration-200"
                              style={{ backgroundColor: bannerColor }}
                            />
                            
                            {/* Avatar Box */}
                            <div className="w-[90px] h-[90px] rounded-full absolute top-[75px] left-[16px] border-[6px] border-[#232428] bg-[#2B2D31]">
                              <img
                                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatarSeed || user?.username || 'You'}`}
                                alt="Avatar"
                                className="w-full h-full rounded-full object-cover"
                              />
                              {/* Status indicator (green online status) */}
                              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#232428] flex items-center justify-center">
                                <div className="w-3.5 h-3.5 rounded-full bg-[#23A55A]" />
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="bg-[#111214] m-4 mt-[50px] p-4 rounded-lg">
                              {/* Display Name */}
                              <div className="text-xl font-bold text-white leading-tight truncate">
                                {displayName.trim() || user?.username || 'YUTO'}
                              </div>
                              {/* Username */}
                              <div className="text-sm text-gray-400">
                                @{user?.username?.toLowerCase() || 'chucaom'}
                              </div>
                              
                              {/* Pronouns badge */}
                              {pronouns.trim() && (
                                <div className="mt-1.5">
                                  <span className="inline-block text-[10px] font-bold bg-[#2B2D31] text-gray-300 px-2 py-0.5 rounded">
                                    {pronouns}
                                  </span>
                                </div>
                              )}

                              {/* Divider */}
                              <div className="border-b border-[#2B2D31] my-3" />

                              {/* About Me Section */}
                              <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">About Me</h4>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                  {aboutMe.trim() || 'No description provided.'}
                                </p>
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                ) : (
                  // Other Tab Placeholder Views
                  <div className="py-10">
                    <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">
                      {settingsTab === 'profiles' ? 'Profiles' : settingsTab === 'privacy' ? 'Privacy & Safety' : settingsTab.toUpperCase()}
                    </h2>
                    <p className="text-gray-400 text-sm">This settings view is a UI placeholder matching Discord's setup.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Unsaved Changes Bar */}
            {isDirty && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-[#111214] rounded-lg p-3 flex items-center justify-between shadow-2xl transition-all duration-300 transform translate-y-0 z-50 animate-fade-in">
                <span className="text-sm font-medium text-white">Careful — you have unsaved changes!</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDisplayName(initialSettingsRef.current.displayName);
                      setPronouns(initialSettingsRef.current.pronouns);
                      setAboutMe(initialSettingsRef.current.aboutMe);
                      setBannerColor(initialSettingsRef.current.bannerColor);
                      setIsDirty(false);
                    }}
                    className="text-white hover:underline text-sm px-4 py-2 focus:outline-none"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      console.log("Saving changes:", {
                        displayName,
                        pronouns,
                        aboutMe,
                        bannerColor
                      });
                      initialSettingsRef.current = {
                        displayName,
                        pronouns,
                        aboutMe,
                        bannerColor
                      };
                      setIsDirty(false);
                    }}
                    className="bg-[#248046] hover:bg-[#1A6334] text-white rounded px-4 py-2 text-sm font-medium transition-colors focus:outline-none"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

          </div>

          </div>
        </div>
      )}

    </div>
  );
}
