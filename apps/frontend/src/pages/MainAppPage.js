import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useChat } from '../context/ChatContext.js';
import logo2 from '../assets/AntiGR Logo 02.png';
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
  X
} from 'lucide-react';

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
    createChannel
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

  // Modals visibility and fields
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverNameInput, setServerNameInput] = useState('');

  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelNameInput, setChannelNameInput] = useState('');
  const [channelTypeInput, setChannelTypeInput] = useState('text');

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
    if (!serverNameInput.trim()) return;
    const res = await createServer(serverNameInput);
    if (res.success) {
      setServerNameInput('');
      setShowServerModal(false);
    } else {
      alert(`Error creating server: ${res.error}`);
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
          <div className="absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 h-10 group-hover:h-10" />
          <button className="w-12 h-12 rounded-2xl bg-[#5865F2] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200">
            <img src={logo2} alt="AntiGroup Home" className="w-10 h-10 object-contain" />
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
              onClick={() => setShowServerModal(true)}
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
      <aside className="w-60 bg-[#2B2D31] flex flex-col flex-shrink-0">
        <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 font-bold text-white shadow-sm cursor-pointer hover:bg-[#35373C] transition">
          <span className="truncate">{activeServer ? activeServer.name : 'No Server Selected'}</span>
          <ChevronDown className="w-5 h-5 text-gray-300" />
        </header>

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
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition group
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
              onClick={logout}
              className="p-1.5 rounded hover:bg-[#3F4147] hover:text-red-500 hover:text-gray-200 transition"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </aside>

      {/* 3. CHAT AREA */}
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

      {/* 4. ACTIVE MEMBERS SIDEBAR (Right) */}
      {showMembersList && activeServer && (
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
      )}

      {/* 5. CREATE SERVER MODAL */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#313338] rounded-md shadow-2xl p-6 relative border border-gray-800 animate-fade-in">
            <button
              onClick={() => setShowServerModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-center text-white mb-2">Create Your Server</h2>
            <p className="text-sm text-gray-400 text-center mb-6">
              Give your new server a personality with a name. You can always change it later.
            </p>
            <form onSubmit={handleCreateServer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Study Group"
                  value={serverNameInput}
                  onChange={(e) => setServerNameInput(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-gray-800 rounded p-3 text-sm text-gray-100 outline-none focus:border-[#5865F2]"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded transition"
              >
                Create Server
              </button>
            </form>
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

    </div>
  );
}
