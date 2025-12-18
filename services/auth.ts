
import { supabase } from './supabaseClient';

export const authService = {
  signUp: async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signUp({ email, password: pass });
  },

  signIn: async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signInWithPassword({ email, password: pass });
  },

  signInWithGoogle: async () => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  },

  signInWithPhone: async (phone: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signInWithOtp({ phone });
  },

  verifyOtp: async (phone: string, token: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  },

  resetPassword: async (email: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  signOut: async () => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signOut();
  }
};
