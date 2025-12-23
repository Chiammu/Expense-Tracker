
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatMessage } from '../types';
import { encryptionService } from '../services/crypto';

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
        const decryptedMessages = await Promise.all(data.map(async (m: any) => ({
            id: m.id,
            sender: m.sender,
            text: await encryptionService.decrypt(m.content, syncId),
            timestamp: m.created_at
        })));
        setMessages(decryptedMessages);
      }
      setLoading(false);
    };

    loadMessages();

    // Subscribe to new messages (INSERT events)
    const channel = supabase.channel(`room-${syncId}-chat`)
    .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sync_id=eq.${syncId}` },
        async (payload: any) => {
            const newMsg = payload.new;
            const decryptedText = await encryptionService.decrypt(newMsg.content, syncId);
            const mapped: ChatMessage = {
                id: newMsg.id,
                sender: newMsg.sender,
                text: decryptedText,
                timestamp: newMsg.created_at
            };
            
            setMessages(prev => {
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
    
    const tempId = crypto.randomUUID();
    const tempMsg: ChatMessage = {
        id: tempId,
        sender,
        text,
        timestamp: new Date().toISOString()
    };
    
    // UI update remains plain text for the sender immediately
    setMessages(prev => [...prev, tempMsg]);

    // Encrypt before network
    const encryptedText = await encryptionService.encrypt(text, syncId);

    const { error } = await supabase.from('messages').insert({
        id: tempId, 
        sync_id: syncId,
        sender,
        content: encryptedText
    });

    if (error) {
        console.error("Error sending message:", error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  return { messages, loading, sendMessage };
};
