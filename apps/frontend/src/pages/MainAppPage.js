import React, { useState, useRef, useEffect } from 'react';
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
  Signal
} from 'lucide-react';

// Mock database for servers, channels, and messages to make the UI interactive
const MOCK_SERVERS = [
  {
    id: 'server-1',
    name: 'AntiGroup HQ',
    abbr: 'AG',
    unread: true,
    channels: [
      { id: 'c-1', name: 'general', type: 'text' },
      { id: 'c-2', name: 'development', type: 'text' },
      { id: 'c-3', name: 'design-feedback', type: 'text' },
      { id: 'c-4', name: 'Lounge', type: 'voice' },
      { id: 'c-5', name: 'Gaming Zone', type: 'voice' }
    ]
  },
  {
    id: 'server-2',
    name: 'Study Room',
    abbr: 'SR',
    unread: false,
    channels: [
      { id: 'c-6', name: 'announcements', type: 'text' },
      { id: 'c-7', name: 'resources', type: 'text' },
      { id: 'c-8', name: 'questions', type: 'text' },
      { id: 'c-9', name: 'Silent Study', type: 'voice' }
    ]
  },
  {
    id: 'server-3',
    name: 'Gamers Unite',
    abbr: 'GU',
    unread: true,
    channels: [
      { id: 'c-10', name: 'squad-chat', type: 'text' },
      { id: 'c-11', name: 'patch-notes', type: 'text' },
      { id: 'c-12', name: 'Duo Queue', type: 'voice' },
      { id: 'c-13', name: 'Squad Room 1', type: 'voice' }
    ]
  }
];

const INITIAL_MESSAGES = {
  'c-1': [
    { id: 'm1', user: 'Alex', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Alex', time: '11:20 AM', text: 'Welcome to AntiGroup HQ! This is a strictly web-based real-time app.' },
    { id: 'm2', user: 'Sophia', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Sophia', time: '11:22 AM', text: 'Awesome! Glad to see how clean the dark layout is. Fits perfectly.' },
    { id: 'm3', user: 'Ryan', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ryan', time: '11:24 AM', text: 'Let\'s test the messaging speed and try voice chat later.' }
  ],
  'c-2': [
    { id: 'm4', user: 'Ryan', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ryan', time: 'Yesterday', text: 'Working on getting the WebSocket handlers configured in backend-realtime.' },
    { id: 'm5', user: 'Admin', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Admin', time: 'Yesterday', text: 'Make sure to follow the architecture file specs!' }
  ],
  'c-3': [
    { id: 'm6', user: 'Sophia', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Sophia', time: 'Today', text: 'We should use rounded-2xl avatars, looks cleaner than simple circles.' }
  ]
};

export default function MainAppPage() {
  // Navigation states
  const [activeServerId, setActiveServerId] = useState('server-1');
  const [activeChannelId, setActiveChannelId] = useState('c-1');
  const [connectedVoiceId, setConnectedVoiceId] = useState(null); // Which voice channel the user is joined in
  
  // Collapse states for Channel Lists
  const [collapseText, setCollapseText] = useState(false);
  const [collapseVoice, setCollapseVoice] = useState(false);

  // User peripheral states
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Chat/messaging states
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  
  const messagesEndRef = useRef(null);

  // Get active Server and Channel objects
  const activeServer = MOCK_SERVERS.find(s => s.id === activeServerId) || MOCK_SERVERS[0];
  const activeChannel = activeServer.channels.find(c => c.id === activeChannelId) || activeServer.channels[0];

  // Scroll to bottom of message list on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId]);

  // Handle message sending
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      id: `user-msg-${Date.now()}`,
      user: 'You',
      avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=You',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: inputText
    };

    setMessages(prev => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), newMessage]
    }));
    setInputText('');
  };

  // Toggle user audio states
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);
    // In Discord, deafening oneself automatically mutes the mic
    if (nextDeafen) {
      setIsMuted(true);
    }
  };

  // Trigger when a voice channel is clicked
  const handleVoiceChannelClick = (channelId) => {
    if (connectedVoiceId === channelId) {
      setConnectedVoiceId(null); // Disconnect
    } else {
      setConnectedVoiceId(channelId); // Connect
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#313338] text-gray-100 font-sans overflow-hidden select-none">
      
      {/* 1. SERVER SIDEBAR */}
      <aside className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 flex-shrink-0">
        
        {/* AntiGroup Home / Logo */}
        <div className="relative group flex items-center justify-center w-full">
          {/* Active bar pill */}
          <div className="absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 h-10 group-hover:h-10" />
          
          <button className="w-12 h-12 rounded-2xl bg-[#5865F2] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200">
            <Sparkles className="w-6 h-6" />
          </button>
          
          {/* Tooltip */}
          <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
            AntiGroup Home
          </div>
        </div>

        {/* Divider */}
        <div className="w-8 h-[2px] bg-[#313338] my-1 rounded" />

        {/* Scrollable Server List */}
        <div className="flex-1 w-full flex flex-col gap-2 overflow-y-auto no-scrollbar">
          {MOCK_SERVERS.map((server) => {
            const isActive = server.id === activeServerId;
            return (
              <div key={server.id} className="relative group flex items-center justify-center w-full">
                
                {/* Left indicators (Pills) */}
                <div className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 
                  ${isActive ? 'h-10' : server.unread ? 'h-2.5 group-hover:h-5' : 'h-0 group-hover:h-5'}`} 
                />

                {/* Server Icon Button */}
                <button
                  onClick={() => {
                    setActiveServerId(server.id);
                    // Default to first text channel in the selected server
                    const firstChan = server.channels.find(c => c.type === 'text');
                    if (firstChan) setActiveChannelId(firstChan.id);
                  }}
                  className={`w-12 h-12 flex items-center justify-center text-sm font-bold tracking-wide transition-all duration-200 
                    ${isActive 
                      ? 'rounded-2xl bg-[#5865F2] text-white' 
                      : 'rounded-[24px] bg-[#313338] text-gray-300 hover:rounded-2xl hover:bg-[#5865F2] hover:text-white'}`}
                >
                  {server.abbr}
                </button>

                {/* Tooltip */}
                <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                  {server.name}
                </div>
              </div>
            );
          })}

          {/* Add a Server */}
          <div className="relative group flex items-center justify-center w-full">
            <button className="w-12 h-12 rounded-[24px] bg-[#313338] text-emerald-500 hover:rounded-2xl hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all duration-200">
              <Plus className="w-6 h-6" />
            </button>
            <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Add a Server
            </div>
          </div>

          {/* Discover Servers */}
          <div className="relative group flex items-center justify-center w-full">
            <button className="w-12 h-12 rounded-[24px] bg-[#313338] text-emerald-500 hover:rounded-2xl hover:bg-[#5865F2] hover:text-white flex items-center justify-center transition-all duration-200">
              <Compass className="w-6 h-6" />
            </button>
            <div className="absolute left-20 bg-gray-950 text-gray-100 text-xs font-bold px-3 py-1.5 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              Explore Discoverable Servers
            </div>
          </div>
        </div>
      </aside>

      {/* 2. CHANNELS SIDEBAR */}
      <aside className="w-60 bg-[#2B2D31] flex flex-col flex-shrink-0">
        
        {/* Server Header Dropdown */}
        <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 font-bold text-white shadow-sm cursor-pointer hover:bg-[#35373C] transition">
          <span className="truncate">{activeServer.name}</span>
          <ChevronDown className="w-5 h-5 text-gray-300" />
        </header>

        {/* Scrollable Channel Category lists */}
        <div className="flex-1 overflow-y-auto pt-4 px-2 space-y-4">
          
          {/* TEXT CHANNELS CATEGORY */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1 py-1 hover:text-gray-200 cursor-pointer">
              <button 
                onClick={() => setCollapseText(!collapseText)} 
                className="flex items-center gap-1 uppercase tracking-wider text-left"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${collapseText ? '-rotate-90' : ''}`} />
                Text Channels
              </button>
              <Plus className="w-4 h-4 hover:text-white" />
            </div>
            
            {!collapseText && (
              <div className="mt-1 space-y-[2px]">
                {activeServer.channels
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

          {/* VOICE CHANNELS CATEGORY */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1 py-1 hover:text-gray-200 cursor-pointer">
              <button 
                onClick={() => setCollapseVoice(!collapseVoice)} 
                className="flex items-center gap-1 uppercase tracking-wider text-left"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${collapseVoice ? '-rotate-90' : ''}`} />
                Voice Channels
              </button>
              <Plus className="w-4 h-4 hover:text-white" />
            </div>

            {!collapseVoice && (
              <div className="mt-1 space-y-[2px]">
                {activeServer.channels
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

        {/* VOICE CONNECTED STATUS BANNER (shows when joined a voice room) */}
        {connectedVoiceId && (
          <div className="bg-[#232428] border-b border-[#1E1F22] p-3 flex flex-col gap-1 text-white text-xs select-none">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Signal className="w-4 h-4 animate-pulse" />
              <span>Voice Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 truncate">
                {activeServer.channels.find(c => c.id === connectedVoiceId)?.name} / {activeServer.name}
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
                src="https://api.dicebear.com/7.x/pixel-art/svg?seed=You" 
                alt="Avatar" 
                className="w-8 h-8 rounded-full bg-slate-800"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#232428]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white leading-tight truncate">AntiUser</span>
              <span className="text-[10px] text-gray-400 leading-none truncate">#1337</span>
            </div>
          </div>

          {/* Controls: Mute, Deafen, Settings */}
          <div className="flex items-center text-gray-400 gap-0.5">
            <button 
              onClick={toggleMute}
              className={`p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition ${isMuted ? 'text-red-500' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            
            <button 
              onClick={toggleDeafen}
              className={`p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition ${isDeafened ? 'text-red-500' : ''}`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones className="w-4 h-4" />
            </button>

            <button 
              className="p-1.5 rounded hover:bg-[#3F4147] hover:text-gray-200 transition"
              title="User Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </aside>

      {/* 3. CHAT AREA */}
      <main className="flex-1 bg-[#313338] flex flex-col min-w-0">
        
        {/* Chat Area Header Bar */}
        <header className="h-12 border-b border-[#1E1F22] flex items-center justify-between px-4 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-white">
            <Hash className="w-6 h-6 text-gray-400" />
            <span>{activeChannel.name}</span>
          </div>

          {/* Header Controls */}
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
              <button className="p-1 rounded hover:text-gray-200 hover:bg-[#3F4147] transition">
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
            <h1 className="text-3xl font-black text-white mb-1">Welcome to #{activeChannel.name}!</h1>
            <p className="text-gray-400 text-sm">This is the start of the #{activeChannel.name} channel history.</p>
          </div>

          {/* Render Active Channel Messages */}
          {(messages[activeChannelId] || []).map((msg) => (
            <div key={msg.id} className="flex gap-4 group hover:bg-[#2e3035] -mx-4 px-4 py-1.5 transition duration-100">
              
              {/* Avatar Icon */}
              <img 
                src={msg.avatar} 
                alt={`${msg.user} Avatar`} 
                className="w-10 h-10 rounded-full bg-slate-800 flex-shrink-0"
              />

              {/* Message Content Layout */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white hover:underline cursor-pointer">
                    {msg.user}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {msg.time}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mt-1 select-text leading-relaxed break-words">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}

          {/* Anchor to scroll to bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Typing Tray (Chat Input Box) */}
        <form onSubmit={handleSendMessage} className="px-4 pb-6 flex-shrink-0">
          <div className="bg-[#383A40] rounded-lg p-2.5 flex items-center gap-3">
            
            {/* Attachment Button */}
            <button 
              type="button" 
              className="p-1 text-gray-400 hover:text-gray-200 bg-[#4E5058] rounded-full hover:bg-gray-600 transition flex items-center justify-center"
            >
              <Plus className="w-4 h-4 text-[#313338]" strokeWidth={3} />
            </button>

            {/* Input Element */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message #` + activeChannel.name}
              className="bg-transparent border-none outline-none text-gray-100 placeholder-gray-500 text-sm flex-1"
            />

            {/* Options icons */}
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

      </main>

    </div>
  );
}
