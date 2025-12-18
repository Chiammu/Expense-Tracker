
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onAuthSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'phone' | 'otp';

export const Auth: React.FC<AuthProps> = ({ showToast }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const isConfigured = !!supabase;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return showToast("Supabase is not configured", "error");
    
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await authService.signIn(email, password);
        if (error) throw error;
        showToast("Welcome back!", "success");
      } else if (mode === 'signup') {
        const { error } = await authService.signUp(email, password);
        if (error) throw error;
        showToast("Check your email to verify your account!", "info");
      } else if (mode === 'forgot') {
        const { error } = await authService.resetPassword(email);
        if (error) throw error;
        showToast("Password reset link sent to your email!", "success");
        setMode('login');
      }
    } catch (err: any) {
      showToast(err.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isConfigured) return showToast("Supabase is not configured", "error");
    setLoading(true);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      showToast(err.message || "Social login failed", "error");
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return showToast("Supabase is not configured", "error");
    
    // Simple validation for international format
    if (!phone.startsWith('+')) {
      showToast("Please include country code (e.g., +91)", "info");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { error } = await authService.signInWithPhone(phone);
      if (error) throw error;
      setMode('otp');
      showToast("OTP sent successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to send OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return showToast("Enter a valid 6-digit OTP", "info");
    
    setLoading(true);
    try {
      const { error } = await authService.verifyOtp(phone, otp);
      if (error) throw error;
      showToast("Signed in successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background text-center">
        <div className="max-w-md bg-surface p-8 rounded-3xl shadow-xl border border-red-100">
           <div className="text-5xl mb-4">⚠️</div>
           <h2 className="text-xl font-bold text-red-600 mb-2">Supabase Missing</h2>
           <p className="text-sm text-text-light mb-4">
             Please provide <code className="bg-gray-100 p-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-gray-100 p-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable authentication and cloud sync.
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💖</div>
          <h1 className="text-2xl font-black text-primary transition-all">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
            {mode === 'phone' && 'Phone Login'}
            {mode === 'otp' && 'Verify OTP'}
          </h1>
          <p className="text-text-light text-sm mt-2">
            {mode === 'login' && 'Manage your couple finances together'}
            {mode === 'signup' && 'Start your collaborative journey'}
            {mode === 'forgot' && 'Enter your email to get a reset link'}
            {mode === 'phone' && 'Sign in with your mobile number'}
            {mode === 'otp' && `Enter the code sent to ${phone}`}
          </p>
        </div>

        {/* Form Container */}
        <div className="min-h-[220px]">
          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <form onSubmit={handleEmailAuth} className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-text-light ml-1">Email Address</label>
                <input 
                  type="email" 
                  required 
                  autoFocus
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm" 
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] uppercase font-black text-text-light">Password</label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-[10px] text-primary font-bold hover:underline">Forgot?</button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    required 
                    className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm" 
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (
                   <span className="flex items-center justify-center gap-2">
                     <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                     Processing...
                   </span>
                ) : (mode === 'login' ? 'Sign In' : (mode === 'signup' ? 'Sign Up' : 'Send Reset Link'))}
              </button>
            </form>
          )}

          {mode === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-text-light ml-1">Phone Number</label>
                <input 
                  type="tel" 
                  required 
                  autoFocus
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm" 
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
                <p className="text-[10px] text-text-light ml-1 mt-1 italic">Include your country code with +</p>
              </div>
              <button 
                disabled={loading}
                className="w-full py-3 bg-secondary text-white font-bold rounded-xl shadow-lg shadow-secondary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-text-light ml-1">One-Time Password</label>
                <input 
                  type="text" 
                  required 
                  maxLength={6}
                  autoFocus
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-center text-xl font-bold tracking-widest" 
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button 
                disabled={loading}
                className="w-full py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button 
                type="button" 
                onClick={() => setMode('phone')} 
                className="w-full text-xs text-text-light font-bold hover:text-primary mt-2"
              >
                Change Number
              </button>
            </form>
          )}
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-text-light font-black">Or continue with</span></div>
        </div>

        {/* Social Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="G" />
            <span className="text-xs font-bold">Google</span>
          </button>
          <button 
            type="button"
            onClick={() => setMode(mode === 'phone' ? 'login' : 'phone')}
            disabled={loading}
            className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-95"
          >
            <span className="text-lg">{mode === 'phone' ? '📧' : '📱'}</span>
            <span className="text-xs font-bold">{mode === 'phone' ? 'Email' : 'Phone'}</span>
          </button>
        </div>

        {/* Footer Toggle */}
        <div className="mt-8 text-center border-t border-gray-50 dark:border-gray-800 pt-6">
          <p className="text-sm text-text-light">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
              }}
              className="ml-1 text-primary font-bold hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
