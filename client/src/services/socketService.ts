import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  conversationId: string;
  content: string;
  iv?: string | null;
  isEncrypted: boolean;
  createdAt: number;
  sender: { id: string; username: string };
}

type MessageHandler = (message: Message) => void;
type TypingHandler = (data: { userId: string; username: string; isTyping: boolean }) => void;

class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private globalMessageHandlers: MessageHandler[] = [];
  private typingHandlers: Map<string, TypingHandler[]> = new Map();

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    this.socket.on('new_message', (message: Message) => {
      const handlers = this.messageHandlers.get(message.conversationId) || [];
      handlers.forEach((h) => h(message));
      this.globalMessageHandlers.forEach((h) => h(message));
    });

    this.socket.on('user_typing', (data: { userId: string; username: string; isTyping: boolean; conversationId?: string }) => {
      if (data.conversationId) {
        const handlers = this.typingHandlers.get(data.conversationId) || [];
        handlers.forEach((h) => h(data));
      }
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.messageHandlers.clear();
    this.globalMessageHandlers = [];
    this.typingHandlers.clear();
  }

  joinConversation(conversationId: string): void {
    this.socket?.emit('join_conversation', conversationId);
  }

  sendMessage(
    conversationId: string,
    content: string,
    iv?: string | null,
    isEncrypted = false
  ): Promise<{ success: boolean; message?: Message; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.socket.emit(
        'send_message',
        { conversationId, content, iv, isEncrypted },
        (response: { success?: boolean; message?: Message; error?: string }) => {
          resolve({ ...response, success: response.success ?? false });
        }
      );
    });
  }

  emitTyping(conversationId: string, isTyping: boolean): void {
    this.socket?.emit('typing', { conversationId, isTyping });
  }

  onMessage(conversationId: string, handler: MessageHandler): () => void {
    const handlers = this.messageHandlers.get(conversationId) || [];
    handlers.push(handler);
    this.messageHandlers.set(conversationId, handlers);
    return () => {
      const current = this.messageHandlers.get(conversationId) || [];
      this.messageHandlers.set(
        conversationId,
        current.filter((h) => h !== handler)
      );
    };
  }

  onAnyMessage(handler: MessageHandler): () => void {
    this.globalMessageHandlers.push(handler);
    return () => {
      this.globalMessageHandlers = this.globalMessageHandlers.filter((h) => h !== handler);
    };
  }

  onTyping(conversationId: string, handler: TypingHandler): () => void {
    const handlers = this.typingHandlers.get(conversationId) || [];
    handlers.push(handler);
    this.typingHandlers.set(conversationId, handlers);
    return () => {
      const current = this.typingHandlers.get(conversationId) || [];
      this.typingHandlers.set(
        conversationId,
        current.filter((h) => h !== handler)
      );
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
export type { Message };
