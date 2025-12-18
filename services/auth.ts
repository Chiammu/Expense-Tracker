
import { supabase } from './supabaseClient';

export const authService = {
  signUp: async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signUp({ 
      email, 
      password: pass,
      options: {
        emailRedirectTo: window.location.origin,
      }
    });
  },

  signIn: async (email: string, pass: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    return await supabase.auth.signInWithPassword({ email, password: pass });
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
