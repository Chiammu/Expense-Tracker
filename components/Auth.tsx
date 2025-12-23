
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onAuthSuccess: () => void;
  onGuestLogin: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

// Fixed: Added missing React import to resolve namespace errors for React.FC and React.FormEvent
export const Auth: React.FC<AuthProps> = ({ showToast, onGuestLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isConfigured = !!supabase;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return showToast("Supabase is not configured. Use Guest Mode.", "error");
    
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

  const handleGoogleAuth = async () => {
    if (!isConfigured) return showToast("Supabase is not configured.", "error");
    setLoading(true);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      showToast(err.message || "Google sign-in failed", "error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-surface p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💖</div>
          <h1 className="text-2xl font-black text-primary transition-all">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-text-light text-sm mt-2">
            {mode === 'login' && 'Manage your couple finances together'}
            {mode === 'signup' && 'Start your collaborative journey'}
            {mode === 'forgot' && 'Enter your email to get a reset link'}
          </p>
        </div>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl flex items-center gap-3">
            <span className="text-xl">☁️</span>
            <div>
              <p className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider">Cloud Offline</p>
              <p className="text-[10px] text-orange-600 dark:text-orange-300">Credentials missing. Please use guest mode to explore.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 animate-fade-in">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-text-light ml-1">Email Address</label>
            <input 
              type="email" 
              required 
              disabled={!isConfigured}
              autoFocus
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm disabled:opacity-50" 
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
                disabled={!isConfigured}
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm disabled:opacity-50" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          )}

          <button 
            disabled={loading || !isConfigured}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
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
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-text-light font-black">OR</span></div>
        </div>

        <div className="space-y-3">
          <button 
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading || !isConfigured}
            className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-text font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Continue with Google
          </button>

          <button 
            onClick={onGuestLogin}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-secondary to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-secondary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>🚀</span> Explore as Guest
          </button>
        </div>

        <div className="mt-8 text-center border-t border-gray-50 dark:border-gray-800 pt-6">
          <p className="text-sm text-text-light">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button"
              disabled={!isConfigured}
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
