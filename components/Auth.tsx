
import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onAuthSuccess: () => void;
  onGuestLogin: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export const Auth: React.FC<AuthProps> = ({ showToast, onGuestLogin, onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const isConfigured = !!supabase;

  // Detect if we are returning from an OAuth flow or Email Confirmation (PKCE)
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if ((hash && (hash.includes('access_token=') || hash.includes('error='))) ||
      (search && search.includes('code='))) {
      setIsFinalizing(true);
      // Give it a few seconds to settle, the listener in App.tsx will handle the actual session change
      const timer = setTimeout(() => setIsFinalizing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return showToast("Supabase is not configured. Use Guest Mode.", "error");

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error } = await authService.signIn(email, password);
        console.log("SignIn Result:", { data, error });
        if (error) throw error;
        if (data.session) {
          showToast("Login successful! Redirecting...", "success");
          onAuthSuccess();
        } else {
          // Sometimes session is null if email confirmation is required but no error returned (rare)
          if (data.user && !data.session) {
            showToast("Please check your email to confirm your account.", "info");
          }
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match!");
        }
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

  const handleGoogleAuth = async () => {
    if (!isConfigured) return showToast("Supabase is not configured.", "error");
    setLoading(true);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) throw error;
      // The browser will redirect away now
    } catch (err: any) {
      showToast(err.message || "Google sign-in failed", "error");
      setLoading(false);
    }
  };

  if (isFinalizing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a] relative overflow-hidden">
        {/* Ambient glow orbs */}
        <div className="absolute top-[-30%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center animate-fade-in relative z-10">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-white mb-2">Finalizing Login...</h2>
          <p className="text-white/40 text-sm">Setting up your secure workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a] relative overflow-hidden">

      {/* Ambient glow orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white/[0.05] backdrop-blur-2xl p-8 rounded-[28px] border border-white/[0.10] shadow-[0_24px_80px_rgba(0,0,0,0.5)] animate-scale-in">

        {/* Brand Mark */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-primary to-pink-400 mx-auto mb-5 flex items-center justify-center shadow-[0_8px_32px_rgba(233,30,99,0.5)]">
            <span className="text-2xl">💸</span>
          </div>
          <h1 className="text-[26px] font-black text-white tracking-tight">
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Get Started'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-white/40 text-[13px] mt-1.5 font-medium">
            {mode === 'login' && 'Track finances together'}
            {mode === 'signup' && 'Your couples finance hub'}
            {mode === 'forgot' && 'We\'ll send a recovery link'}
          </p>
        </div>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-[16px] flex items-center gap-3">
            <span className="text-xl">☁️</span>
            <div>
              <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider">Cloud Offline</p>
              <p className="text-[10px] text-amber-200/70">Credentials missing. Please use guest mode.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 animate-fade-in">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 ml-1">Email Address</label>
            <input
              type="email"
              required
              disabled={!isConfigured || loading}
              autoFocus
              className="w-full px-4 py-3.5 bg-white/[0.07] border border-white/[0.10] rounded-[14px] text-white text-[15px] font-medium placeholder:text-white/25 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Password</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot')} className="text-[10px] text-primary font-bold hover:underline">Forgot?</button>
                )}
              </div>
              <input
                type="password"
                required
                disabled={!isConfigured || loading}
                className="w-full px-4 py-3.5 bg-white/[0.07] border border-white/[0.10] rounded-[14px] text-white text-[15px] font-medium placeholder:text-white/25 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all outline-none"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 ml-1">Confirm Password</label>
              <input
                type="password"
                required
                disabled={!isConfigured || loading}
                className="w-full px-4 py-3.5 bg-white/[0.07] border border-white/[0.10] rounded-[14px] text-white text-[15px] font-medium placeholder:text-white/25 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all outline-none"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isConfigured}
            className="w-full py-4 bg-primary text-white font-bold rounded-[14px] shadow-[0_4px_24px_rgba(233,30,99,0.45)] active:scale-[0.97] transition-all duration-150 text-[15px] disabled:opacity-50 disabled:grayscale"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (mode === 'login' ? 'Sign In' : (mode === 'signup' ? 'Sign Up' : 'Send Reset Link'))}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.08]"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-white/30 font-black backdrop-blur-xl">OR</span></div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading || !isConfigured}
            className="w-full py-3.5 bg-white/[0.06] border border-white/[0.10] text-white font-semibold rounded-[14px] hover:bg-white/[0.10] active:scale-95 transition-all flex items-center justify-center gap-3 text-[15px] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={onGuestLogin}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-secondary to-cyan-400 text-white font-bold rounded-[14px] shadow-[0_4px_24px_rgba(33,150,243,0.35)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 text-[15px]"
          >
            <span>🚀</span> Explore as Guest
          </button>
        </div>

        <div className="mt-8 text-center border-t border-white/[0.08] pt-6">
          <p className="text-sm text-white/40">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              disabled={!isConfigured || loading}
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="ml-1 text-primary font-bold hover:underline disabled:opacity-50"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
