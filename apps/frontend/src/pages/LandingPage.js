import React, { useState } from 'react';
import logo from '../assets/AntiGR Logo.png';
import { 
  Menu, 
  X, 
  MessageSquare, 
  Headphones, 
  Users, 
  Hash, 
  Shield, 
  HelpCircle, 
  BookOpen, 
  FileText, 
  ChevronRight,
  Globe,
  Compass,
  ArrowRight
} from 'lucide-react';

/**
 * Navbar Component
 * Renders the top navigation bar with a solid Blurple [#5865F2] background.
 * Responsive design: shows a hamburger menu on mobile and full links on desktop.
 */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-[#5865F2] text-white sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <img src={logo} alt="AntiGroup Logo" className="h-12 w-auto object-contain cursor-pointer hover:opacity-90 transition duration-150" />
            <span className="text-2xl font-black tracking-wider cursor-pointer hover:opacity-90 transition duration-150">
              AntiGroup
            </span>
          </div>

          {/* Center Links (Hidden on mobile) */}
          <div className="hidden md:flex space-x-8 text-sm font-bold tracking-wide">
            <a href="#features" className="hover:text-blue-100 hover:underline transition duration-150">Features</a>
            <a href="#safety" className="hover:text-blue-100 hover:underline transition duration-150">Safety</a>
            <a href="#support" className="hover:text-blue-100 hover:underline transition duration-150">Support</a>
            <a href="#community" className="hover:text-blue-100 hover:underline transition duration-150">Community</a>
          </div>

          {/* Right Button */}
          <div className="hidden md:block">
            <a href="#app" className="bg-white text-[#5865F2] font-bold px-6 py-2.5 rounded-full text-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 inline-block text-center">
              Login
            </a>
          </div>

          {/* Hamburger Menu Icon (Mobile only) */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md hover:text-blue-100 focus:outline-none transition duration-150"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="md:hidden bg-[#4752C4] border-t border-[#5865F2] shadow-xl animate-fade-in-down">
          <div className="px-2 pt-4 pb-6 space-y-2 sm:px-3 text-center">
            <a 
              href="#features" 
              onClick={() => setIsOpen(false)}
              className="block px-3 py-3 rounded-md text-base font-bold hover:bg-[#3c45a3] transition duration-150"
            >
              Features
            </a>
            <a 
              href="#safety" 
              onClick={() => setIsOpen(false)}
              className="block px-3 py-3 rounded-md text-base font-bold hover:bg-[#3c45a3] transition duration-150"
            >
              Safety
            </a>
            <a 
              href="#support" 
              onClick={() => setIsOpen(false)}
              className="block px-3 py-3 rounded-md text-base font-bold hover:bg-[#3c45a3] transition duration-150"
            >
              Support
            </a>
            <a 
              href="#community" 
              onClick={() => setIsOpen(false)}
              className="block px-3 py-3 rounded-md text-base font-bold hover:bg-[#3c45a3] transition duration-150"
            >
              Community
            </a>
            <div className="pt-4 border-t border-blue-500 mt-4">
              <a href="#app" className="block w-full bg-white text-[#5865F2] font-bold px-6 py-3 rounded-full text-base transition-all duration-200 hover:shadow-lg text-center">
                Login
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

/**
 * Hero Section Component
 * Gradient blurple background, chunky typography, bouncy buttons,
 * and a bottom wavy SVG curve to smoothly flow into the next section.
 */
const Hero = () => {
  return (
    <section className="relative bg-gradient-to-b from-[#5865F2] to-[#4752C4] text-white overflow-hidden pt-20 pb-32 md:pt-32 md:pb-44 lg:pt-36 lg:pb-48 flex flex-col items-center justify-center">
      {/* Decorative background grids/glows */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-300 rounded-full blur-[140px] opacity-20 pointer-events-none"></div>

      <div className="relative max-w-4xl mx-auto px-4 text-center z-20">
        {/* Chunky Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight uppercase mb-6 leading-tight select-none">
          IMAGINE A PLACE...
        </h1>
        
        {/* Subheading */}
        <p className="text-base sm:text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          ...where you can belong to a school club, a gaming group, or a worldwide art community. 
          A web-based platform that makes it easy to talk every day and hang out more often, 
          straight from your browser without installing anything.
        </p>

        {/* CTA Bouncy Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mb-12">
          <a href="#app" className="w-full sm:w-auto bg-white text-black hover:text-[#5865F2] font-semibold px-8 py-4 rounded-full text-md transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 flex items-center justify-center gap-2 text-center">
            Open in your browser
          </a>
          <a href="#app" className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-full text-md transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 flex items-center justify-center gap-2 text-center">
            Sign Up Now
          </a>
        </div>
      </div>

      {/* Abstract Background Figures */}
      <div className="hidden lg:block absolute bottom-12 left-0 w-1/4 max-w-[280px] pointer-events-none select-none z-10 transform translate-x-4">
        {/* Left Side Illustration */}
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto text-[#8a94fc] opacity-60">
          <circle cx="100" cy="120" r="50" fill="currentColor" fillOpacity="0.15" />
          <path d="M40 160C40 137.909 57.9086 120 80 120H120C142.091 120 160 137.909 160 160" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="100" cy="80" r="24" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="60" r="8" fill="currentColor" />
          <circle cx="160" cy="70" r="12" fill="currentColor" />
          <path d="M125 65L145 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div className="hidden lg:block absolute bottom-12 right-0 w-1/4 max-w-[280px] pointer-events-none select-none z-10 transform -translate-x-4">
        {/* Right Side Illustration */}
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto text-[#8a94fc] opacity-60">
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="3" strokeDasharray="6 6" />
          <rect x="75" y="80" width="50" height="50" rx="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="4" />
          <circle cx="100" cy="105" r="12" stroke="currentColor" strokeWidth="4" />
          <path d="M60 100H45" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M140 100H155" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Curved Bottom Wave Overlay (fills with white to merge with next section) */}
      <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-0">
        <svg className="relative block w-full h-[60px] md:h-[90px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path 
            d="M0,0 C150,90 350,120 600,100 C850,80 1050,90 1200,120 L1200,120 L0,120 Z" 
            fill="#ffffff"
          ></path>
        </svg>
      </div>
    </section>
  );
};

/**
 * Reusable Feature Section Component
 * Handles alternating image positions, titles, descriptions, backgrounds.
 * Includes offset glowing background backdrops behind the rounded card illustrations.
 */
const FeatureSection = ({ imagePosition, title, description, bgColor, illustrationType }) => {
  const isLeft = imagePosition === 'left';

  // Render mock vector illustrations inside the boxes
  const renderIllustration = () => {
    if (illustrationType === 'server-channels') {
      return (
        <svg className="w-4/5 h-4/5 text-gray-400" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main App Layout Panel */}
          <rect x="10" y="10" width="380" height="220" rx="8" fill="#1E293B" />
          
          {/* Left Sidebar (Servers) */}
          <rect x="10" y="10" width="45" height="220" rx="8" fill="#0F172A" />
          <circle cx="32.5" cy="35" r="14" fill="#5865F2" />
          <circle cx="32.5" cy="75" r="14" fill="#334155" />
          <circle cx="32.5" cy="115" r="14" fill="#334155" />
          
          {/* Left Sub-sidebar (Channels) */}
          <rect x="55" y="10" width="100" height="220" fill="#1E293B" />
          <rect x="65" y="25" width="80" height="16" rx="4" fill="#334155" />
          
          {/* Channel items */}
          <g className="text-gray-500">
            <rect x="65" y="60" width="80" height="12" rx="3" fill="#334155" fillOpacity="0.6" />
            <rect x="65" y="80" width="80" height="12" rx="3" fill="#5865F2" fillOpacity="0.3" />
            <rect x="65" y="100" width="80" height="12" rx="3" fill="#334155" fillOpacity="0.6" />
            <rect x="65" y="120" width="80" height="12" rx="3" fill="#334155" fillOpacity="0.6" />
          </g>

          {/* Main Chat Area */}
          <rect x="155" y="10" width="235" height="220" rx="8" fill="#0F172A" fillOpacity="0.5" />
          
          {/* Chat Messages */}
          <circle cx="175" cy="40" r="10" fill="#E2E8F0" />
          <rect x="195" y="32" width="100" height="8" rx="3" fill="#E2E8F0" />
          <rect x="195" y="46" width="140" height="6" rx="2" fill="#64748B" />

          <circle cx="175" cy="80" r="10" fill="#5865F2" />
          <rect x="195" y="72" width="80" height="8" rx="3" fill="#5865F2" />
          <rect x="195" y="86" width="120" height="6" rx="2" fill="#64748B" />

          {/* Chat Input Area */}
          <rect x="165" y="180" width="215" height="30" rx="6" fill="#334155" />
          <circle cx="180" cy="195" r="6" fill="#64748B" />
          <rect x="195" y="192" width="100" height="6" rx="2" fill="#64748B" fillOpacity="0.5" />
        </svg>
      );
    }

    if (illustrationType === 'voice-hangout') {
      return (
        <svg className="w-4/5 h-4/5 text-gray-400" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Grid of Audio Cards */}
          <rect x="20" y="20" width="165" height="90" rx="10" fill="#1E293B" stroke="#10B981" strokeWidth="2" />
          <circle cx="102.5" cy="55" r="20" fill="#10B981" fillOpacity="0.2" />
          <circle cx="102.5" cy="55" r="12" fill="#10B981" />
          <rect x="62.5" y="85" width="80" height="12" rx="4" fill="#10B981" fillOpacity="0.3" />
          
          <rect x="215" y="20" width="165" height="90" rx="10" fill="#1E293B" />
          <circle cx="297.5" cy="55" r="20" fill="#334155" />
          <circle cx="297.5" cy="55" r="12" fill="#64748B" />
          <rect x="257.5" y="85" width="80" height="12" rx="4" fill="#334155" />

          <rect x="20" y="130" width="165" height="90" rx="10" fill="#1E293B" />
          <circle cx="102.5" cy="165" r="20" fill="#334155" />
          <circle cx="102.5" cy="165" r="12" fill="#64748B" />
          <rect x="62.5" y="195" width="80" height="12" rx="4" fill="#334155" />

          <rect x="215" y="130" width="165" height="90" rx="10" fill="#1E293B" stroke="#5865F2" strokeWidth="1" />
          <circle cx="297.5" cy="165" r="20" fill="#5865F2" fillOpacity="0.2" />
          <circle cx="297.5" cy="165" r="12" fill="#5865F2" />
          <rect x="257.5" y="195" width="80" height="12" rx="4" fill="#5865F2" fillOpacity="0.3" />

          {/* Glowing Mic icons */}
          <circle cx="160" cy="35" r="8" fill="#10B981" />
          <path d="M158 35H162" stroke="white" strokeWidth="1.5" />
        </svg>
      );
    }

    return (
      <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
        <Users className="w-8 h-8 text-gray-500" />
      </div>
    );
  };

  return (
    <section className={`py-20 md:py-28 ${bgColor} border-b border-slate-100`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-16 items-center`}>
          
          {/* Image/Illustration Box with glowing offset backdrop */}
          <div className={`lg:col-span-7 ${isLeft ? 'lg:order-1' : 'lg:order-2'}`}>
            <div className="relative w-full max-w-lg mx-auto">
              
              {/* Glowing offset blob behind the card */}
              <div className="absolute -inset-2.5 bg-gradient-to-tr from-[#5865F2] to-indigo-500 rounded-3xl blur-2xl opacity-20 transform translate-x-3 translate-y-3 pointer-events-none"></div>
              
              {/* Main Illustration Panel */}
              <div className="relative bg-[#1E293B] rounded-2xl w-full h-80 md:h-[400px] overflow-hidden flex items-center justify-center shadow-2xl border border-gray-100/10 hover:scale-[1.02] transition-all duration-300">
                {renderIllustration()}
              </div>
            </div>
          </div>

          {/* Text Information */}
          <div className={`lg:col-span-5 ${isLeft ? 'lg:order-2' : 'lg:order-1'} text-center lg:text-left`}>
            {/* Chunky heading */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight mb-6">
              {title}
            </h2>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl leading-relaxed mb-8">
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * Bottom Call to Action Section
 */
const BottomCTA = () => {
  return (
    <section className="bg-slate-50 py-20 md:py-28 text-center relative overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#5865F2_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-8 leading-tight">
          Ready to start your journey?
        </h2>
        {/* Bouncy Button */}
        <a href="#app" className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-10 py-5 rounded-full text-lg sm:text-xl shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0 inline-flex items-center justify-center gap-3">
          Open AntiGroup in Browser
          <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </a>
      </div>
    </section>
  );
};

/**
 * Footer Component
 * Dark slate background, multi-column links, horizontal rules, and branding.
 */
const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Links Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-2 pr-0 lg:pr-8">
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="AntiGroup Logo" className="h-14 w-auto object-contain" />
              <span className="text-3xl font-black tracking-widest text-[#5865F2]">
                AntiGroup
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
              Your web-based space to connect, share, and collaborate with groups, teams, and friends. No installs. Just links.
            </p>
            {/* Social mock icons */}
            <div className="flex space-x-4">
              <span className="p-2 bg-gray-800 hover:bg-[#5865F2] rounded-full cursor-pointer transition text-gray-300 hover:text-white">
                <Globe className="w-5 h-5" />
              </span>
              <span className="p-2 bg-gray-800 hover:bg-[#5865F2] rounded-full cursor-pointer transition text-gray-300 hover:text-white">
                <Compass className="w-5 h-5" />
              </span>
              <span className="p-2 bg-gray-800 hover:bg-[#5865F2] rounded-full cursor-pointer transition text-gray-300 hover:text-white">
                <MessageSquare className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-[#5865F2] font-bold text-sm uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition duration-150 flex items-center gap-1">Download</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Nitro</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Status</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">App Directory</a></li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-[#5865F2] font-bold text-sm uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition duration-150">About</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Jobs</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Brand</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Newsroom</a></li>
            </ul>
          </div>

          {/* Resources & Policies */}
          <div>
            <h3 className="text-[#5865F2] font-bold text-sm uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition duration-150">Support</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Safety</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Blog</a></li>
              <li><a href="#" className="hover:text-white transition duration-150">Feedback</a></li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-gray-800 mb-8" />

        {/* Bottom Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AntiGroup Logo" className="h-8 w-auto object-contain" />
            <span className="text-xl font-bold tracking-wide">
              AntiGroup
            </span>
            <span className="text-xs text-gray-500 font-mono">
              © {new Date().getFullYear()} AntiGroup Inc.
            </span>
          </div>

          <div>
            <button className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium px-6 py-2.5 rounded-full text-sm transition-all duration-200 hover:-translate-y-1 active:translate-y-0 hover:shadow-lg">
              Sign up
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

/**
 * Main LandingPage Export
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased selection:bg-[#5865F2] selection:text-white">
      {/* 1. Navigation Bar */}
      <Navbar />

      {/* 2. Hero Section */}
      <Hero />

      {/* 3. Zig-Zag Feature Sections */}
      <div id="features">
        {/* Section 1: Image on Left (bg-white) */}
        <FeatureSection
          imagePosition="left"
          title="Create an invite-only place where you belong"
          description="AntiGroup servers are organized into topic-based channels where you can collaborate, share, and just talk about your day without clogging up a group chat."
          bgColor="bg-white"
          illustrationType="server-channels"
        />

        {/* Section 2: Image on Right (bg-slate-50) */}
        <FeatureSection
          imagePosition="right"
          title="Where hanging out is easy"
          description="Grab a seat in a voice channel when you're free. Friends in your server can see you're around and instantly pop in to talk."
          bgColor="bg-slate-50"
          illustrationType="voice-hangout"
        />
      </div>

      {/* 4. Bottom CTA & Footer */}
      <BottomCTA />
      <Footer />
    </div>
  );
}
