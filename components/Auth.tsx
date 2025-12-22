
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onAuthSuccess: () => void;
  onGuestLogin: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

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

        <button 
          onClick={onGuestLogin}
          className={`w-full py-3 font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
            !isConfigured 
              ? 'bg-gradient-to-r from-secondary to-cyan-500 text-white shadow-secondary/30' 
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-text hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <span>🚀</span> Explore as Guest
        </button>

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
