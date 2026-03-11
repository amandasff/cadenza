import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessageRow } from '../types';

export class ChatService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static getInstance(supabase: SupabaseClient): ChatService {
    return new ChatService(supabase);
  }

  // Announcements: recipient_id IS NULL — visible to all studio members
  async getAnnouncements(studioId: string, limit = 100): Promise<MessageRow[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select()
      .eq('studio_id', studioId)
      .is('recipient_id', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as MessageRow[];
  }

  // Private thread between two specific users
  async getPrivateThread(
    studioId: string,
    userId1: string,
    userId2: string,
    limit = 100
  ): Promise<MessageRow[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select()
      .eq('studio_id', studioId)
      .or(
        `and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),` +
        `and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as MessageRow[];
  }

  async postAnnouncement(
    studioId: string,
    _senderId: string,
    _senderName: string,
    content: string
  ): Promise<MessageRow> {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studioId, content, recipientId: null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to send message');
    }
    const { message } = await res.json() as { message: MessageRow };
    return message;
  }

  async sendPrivateMessage(
    studioId: string,
    _senderId: string,
    _senderName: string,
    recipientId: string,
    content: string
  ): Promise<MessageRow> {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studioId, content, recipientId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to send message');
    }
    const { message } = await res.json() as { message: MessageRow };
    return message;
  }

  async updateMessage(messageId: string, content: string): Promise<MessageRow> {
    const res = await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to update message');
    }
    return res.json();
  }

  async deleteMessage(messageId: string): Promise<void> {
    const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to delete message');
    }
  }

  // Load hearts for a set of messages
  async getHearts(
    messageIds: string[],
    currentUserId: string
  ): Promise<Record<string, { count: number; liked: boolean }>> {
    if (!messageIds.length) return {};
    try {
      const { data } = await this.supabase
        .from('message_hearts')
        .select('message_id, user_id')
        .in('message_id', messageIds);
      const map: Record<string, { count: number; liked: boolean }> = {};
      for (const h of (data ?? []) as { message_id: string; user_id: string }[]) {
        map[h.message_id] ??= { count: 0, liked: false };
        map[h.message_id].count++;
        if (h.user_id === currentUserId) map[h.message_id].liked = true;
      }
      return map;
    } catch {
      return {}; // table may not exist yet
    }
  }

  // Toggle heart on a message (uses API route)
  async toggleHeart(messageId: string): Promise<{ hearted: boolean }> {
    const res = await fetch(`/api/messages/${messageId}/heart`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to toggle heart');
    }
    return res.json();
  }

  // Subscribe to announcements — handles INSERT, UPDATE, and DELETE in real-time
  subscribeToAnnouncements(
    studioId: string,
    onInsert: (msg: MessageRow) => void,
    onUpdate?: (msg: MessageRow) => void,
    onDelete?: (id: string) => void
  ): () => void {
    const channel = this.supabase
      .channel('announcements:' + studioId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          const msg = payload.new as MessageRow;
          if (msg.recipient_id === null) onInsert(msg);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          if (!onUpdate) return;
          const msg = payload.new as MessageRow;
          if (msg.recipient_id === null) onUpdate(msg);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          if (!onDelete) return;
          const old = payload.old as Partial<MessageRow>;
          if (old.id) onDelete(old.id);
        }
      )
      .subscribe();

    return () => { this.supabase.removeChannel(channel); };
  }

  // System event message (session logged, goal approved, etc.)
  async postSystemMessage(
    studioId: string,
    senderId: string,
    recipientId: string | null,
    content: string
  ): Promise<MessageRow> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        studio_id: studioId,
        sender_id: senderId,
        sender_name: 'System',
        recipient_id: recipientId,
        message_type: 'system',
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return data as MessageRow;
  }

  // Subscribe to a private DM thread — handles INSERT, UPDATE, and DELETE in real-time
  subscribeToPrivateThread(
    studioId: string,
    userId1: string,
    userId2: string,
    onInsert: (msg: MessageRow) => void,
    onUpdate?: (msg: MessageRow) => void,
    onDelete?: (id: string) => void
  ): () => void {
    const channelKey = `dm:${studioId}:${[userId1, userId2].sort().join(':')}`;
    const isThread = (msg: MessageRow) =>
      (msg.sender_id === userId1 && msg.recipient_id === userId2) ||
      (msg.sender_id === userId2 && msg.recipient_id === userId1);

    const channel = this.supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          const msg = payload.new as MessageRow;
          if (msg.recipient_id !== null && isThread(msg)) onInsert(msg);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          if (!onUpdate) return;
          const msg = payload.new as MessageRow;
          if (msg.recipient_id !== null && isThread(msg)) onUpdate(msg);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: 'studio_id=eq.' + studioId },
        (payload) => {
          if (!onDelete) return;
          const old = payload.old as Partial<MessageRow>;
          if (old.id) onDelete(old.id);
        }
      )
      .subscribe();

    return () => { this.supabase.removeChannel(channel); };
  }
}
