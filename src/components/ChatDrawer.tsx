import React, { useState, useEffect, useRef } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { ChatMessage } from "../types";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  username: string;
}

export default function ChatDrawer({ isOpen, onClose, playerId, username }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, orderBy("timestamp", "asc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push(doc.data() as ChatMessage);
      });
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText("");

    try {
      const chatsRef = collection(db, "chats");
      const newId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await addDoc(chatsRef, {
        id: newId,
        senderId: playerId,
        username: username,
        text: textToSend,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "chats");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex justify-end select-none">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-sm bg-slate-900 border-l border-slate-700 flex flex-col h-full shadow-2xl animate-slide-in">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-white text-sm">Global City Chat</span>
            <span className="bg-orange-500/15 text-orange-400 font-mono text-[10px] px-2 py-0.5 rounded-full uppercase">
              Live
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <MessageSquare className="w-8 h-8 text-slate-600 mb-2 animate-bounce" />
              <p className="text-xs text-slate-500 font-mono">No messages yet.</p>
              <p className="text-[10px] text-slate-600 max-w-[180px] mt-1">
                Be the first to announce your block ownership!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === playerId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  <span className="text-[10px] font-mono text-slate-400 mb-0.5 px-1 font-semibold">
                    {msg.username} {isMe && "(You)"}
                  </span>
                  <div
                    className={`rounded-lg p-2.5 text-xs break-words shadow-sm font-sans ${
                      isMe
                        ? "bg-orange-500 text-white rounded-tr-none"
                        : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[8px] font-mono text-slate-600 mt-0.5 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-700 bg-slate-900 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            maxLength={120}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-sans"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-2 rounded-lg flex items-center justify-center transition-colors active:scale-95"
          >
            <Send className="w-4 h-4 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
}
