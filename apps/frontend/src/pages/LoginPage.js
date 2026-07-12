import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { KeyRound, Mail, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const { login, register, confirmSignUp, loginWithGoogle } = useAuth();
  
  // Toggle between login and register state
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isVerifyMode, setIsVerifyMode] = useState(false);
  
  // Form values
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setIsVerifyMode(false);
    setErrorMsg(null);
    setInfoMsg(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setVerificationCode('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    
    // Basic form validation
    if (!email || !password) {
      setErrorMsg('Please enter all required fields.');
      return;
    }

    if (!isLoginMode && !username) {
      setErrorMsg('Username is required for registration.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isLoginMode) {
        result = await login(email, password);
      } else {
        result = await register(username, email, password);
        if (result.success && result.needsVerification) {
          setIsVerifyMode(true);
          setInfoMsg(`A verification code has been sent to ${email}. Please check your email and enter the code below.`);
          setIsSubmitting(false);
          return;
        }
      }

      if (!result.success) {
        setErrorMsg(result.error);
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!verificationCode) {
      setErrorMsg('Please enter the verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmSignUp(email, verificationCode);
      if (result.success) {
        setIsVerifyMode(false);
        setIsLoginMode(true);
        setInfoMsg('Email confirmed successfully! You can now log in.');
      } else {
        setErrorMsg(result.error);
      }
    } catch (err) {
      setErrorMsg('Failed to verify code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const result = await loginWithGoogle(credential);
      if (!result.success) {
        setErrorMsg(result.error);
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during Google sign-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#1E1F22] flex items-center justify-center font-sans antialiased text-gray-100 p-4 select-none">
      {/* Glow Backdrops */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5865F2] rounded-full blur-[160px] opacity-15 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-[160px] opacity-15 pointer-events-none"></div>

      {/* Main Container Card */}
      <div className="w-full max-w-[480px] bg-[#2B2D31] rounded-lg shadow-2xl border border-gray-800/50 p-8 z-10 transition duration-300">
        
        {/* Title / Greetings */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-wide">
            {isVerifyMode ? 'Verify Email' : (isLoginMode ? 'Welcome back!' : 'Create an account')}
          </h1>
          <p className="text-gray-400 text-sm">
            {isVerifyMode 
              ? "We sent a 6-digit confirmation code to your email" 
              : (isLoginMode ? "We're so excited to see you again!" : "Let's get you set up to start talking with friends!")}
          </p>
        </div>

        {/* Error Alert Display */}
        {errorMsg && (
          <div className="mb-6 bg-red-500/15 border border-red-500/40 rounded p-3 text-red-400 text-sm flex items-start gap-2.5 animate-pulse">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Info Alert Display */}
        {infoMsg && (
          <div className="mb-6 bg-emerald-500/15 border border-emerald-500/40 rounded p-3 text-emerald-400 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {isVerifyMode ? (
          /* CODE CONFIRMATION FORM */
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Verification Code <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center bg-[#1E1F22] rounded border border-gray-800 focus-within:border-[#5865F2] transition duration-150">
                <span className="pl-3.5 text-gray-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full bg-transparent border-none outline-none text-sm text-gray-100 placeholder-gray-600 py-3 px-3"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#5865F2]/60 text-white font-bold py-3.5 px-4 rounded transition duration-200 transform active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <span>Confirm Code</span>
              )}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsVerifyMode(false);
                  setIsLoginMode(true);
                  setInfoMsg(null);
                  setErrorMsg(null);
                }}
                className="text-sm text-[#00A8FC] hover:underline bg-transparent border-none outline-none cursor-pointer"
              >
                Back to Log In
              </button>
            </div>
          </form>
        ) : (
          /* SIGN-IN OR SIGN-UP FORM */
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* USERNAME FIELD (Register only) */}
            {!isLoginMode && (
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center bg-[#1E1F22] rounded border border-gray-800 focus-within:border-[#5865F2] transition duration-150">
                  <span className="pl-3.5 text-gray-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your handle name"
                    className="w-full bg-transparent border-none outline-none text-sm text-gray-100 placeholder-gray-600 py-3 px-3"
                  />
                </div>
              </div>
            )}

            {/* EMAIL FIELD */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center bg-[#1E1F22] rounded border border-gray-800 focus-within:border-[#5865F2] transition duration-150">
                <span className="pl-3.5 text-gray-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent border-none outline-none text-sm text-gray-100 placeholder-gray-600 py-3 px-3"
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Password <span className="text-red-500">*</span>
                </label>
                {isLoginMode && (
                  <a href="#" className="text-xs text-[#00A8FC] hover:underline">
                    Forgot your password?
                  </a>
                )}
              </div>
              
              <div className="relative flex items-center bg-[#1E1F22] rounded border border-gray-800 focus-within:border-[#5865F2] transition duration-150">
                <span className="pl-3.5 text-gray-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none outline-none text-sm text-gray-100 placeholder-gray-600 py-3 px-3"
                />
                {/* Show/Hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pr-3 text-gray-500 hover:text-gray-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#5865F2]/60 text-white font-bold py-3.5 px-4 rounded transition duration-200 transform active:scale-[0.99] flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <span>{isLoginMode ? 'Log In' : 'Register'}</span>
              )}
            </button>
          </form>
        )}

        {/* OR Divider (Hidden in verify mode) */}
        {!isVerifyMode && (
          <>
            <div className="flex items-center my-5">
              <div className="flex-grow border-t border-gray-800/40"></div>
              <span className="px-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-gray-800/40"></div>
            </div>

            {/* Google Login Button */}
            <div className="flex justify-center w-full mb-5">
              <div className="w-full" style={{ minHeight: '40px' }}>
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    handleGoogleSuccess(credentialResponse.credential);
                  }}
                  onError={() => {
                    setErrorMsg('Google Sign-In failed. Please try again.');
                  }}
                  theme="filled_blue"
                  size="large"
                  shape="rectangular"
                  width="100%"
                />
              </div>
            </div>

            {/* Auth Mode Toggle Link */}
            <div className="text-left mt-4 text-sm">
              <span className="text-gray-400">
                {isLoginMode ? 'Need an account? ' : 'Already have an account? '}
              </span>
              <button
                onClick={handleToggleMode}
                className="text-[#00A8FC] hover:underline font-medium focus:outline-none bg-transparent border-none outline-none cursor-pointer"
              >
                {isLoginMode ? 'Register' : 'Log In'}
              </button>
            </div>
          </>
        )}

        {/* Back Link */}
        <div className="text-center mt-6 pt-4 border-t border-gray-800/40">
          <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition">
            ← Go back to Homepage
          </a>
        </div>

      </div>
    </div>
  );
}
