import { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatMessage } from '../types';

export const useChat = (syncId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!syncId || !supabase) {
        setMessages([]);
        return;
    }

    const loadMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('sync_id', syncId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) {
          console.error("Error loading messages:", error);
      } else if (data) {
        const mapped: ChatMessage[] = data.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.content,
            timestamp: m.created_at
        }));
        setMessages(mapped);
      }
      setLoading(false);
    };

    loadMessages();

    // Subscribe to new messages (INSERT events)
    const channel = supabase.channel(`room-${syncId}-chat`)
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sync_id=eq.${syncId}` },
        (payload: any) => {
            const newMsg = payload.new;
            const mapped: ChatMessage = {
                id: newMsg.id,
                sender: newMsg.sender,
                text: newMsg.content,
                timestamp: newMsg.created_at
            };
            
            setMessages(prev => {
                // Prevent duplicate if optimistic update already added it
                if (prev.some(m => m.id === mapped.id)) return prev;
                return [...prev, mapped];
            });
        }
    )
    .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [syncId]);

  const sendMessage = async (text: string, sender: 'Person1' | 'Person2') => {
    if (!syncId || !supabase) return;
    
    // 1. Generate ID client-side
    const tempId = crypto.randomUUID();

    // 2. Optimistic Update (Show immediately)
    const tempMsg: ChatMessage = {
        id: tempId,
        sender,
        text,
        timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);

    // 3. Send to Supabase WITH the generated ID
    // This ensures the Realtime event returns the SAME ID, preventing duplicates.
    const { error } = await supabase.from('messages').insert({
        id: tempId, 
        sync_id: syncId,
        sender,
        content: text
    });

    if (error) {
        console.error("Error sending message:", error);
        // Remove optimistic message if failed
        setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  return { messages, loading, sendMessage };
};