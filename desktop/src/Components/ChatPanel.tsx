import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import messages from '../data/mock/messages.json';

type Message = {
  content: string;
  role: string;
  timestamp?: string;
  audioBase64?: string;
};

type ChatPanelProps = {
  title?: string;
  messages?: Message[];
};

const ChatPanel: React.FC<ChatPanelProps> = ({ title = 'Chat Panel' }) => {
  const [value, setValue] = useState('');
  const [messagesState, setMessagesState] = useState<Message[]>(
    messages.map((msg: any) => ({
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
    }))
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesState]);

  const handleSendMessage = async () => {
    if (value.trim() === '') return;
    if (!user) {
      try {
        await axios.post('http://localhost:3001/api/auth/log', {
          userId: 'anonymous',
          intent: 'chat_unauthenticated',
          response: 'Tried to chat without signing in—redirecting to sign-in, babe! 😘',
          userData: { context: 'chat_error', message: value },
        });
      } catch (logError) {
        console.error('Log error:', logError);
      }
      navigate('/', { state: { fromChatUnauthenticated: true } });
      return;
    }

    const newMessage: Message = {
      content: value,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessagesState((prevMessages) => [...prevMessages, newMessage]);
    setValue('');

    try {
      const response = await axios.post('http://localhost:3001/api/chat', {
        userId: user.uid,
        message: value,
      });
      const reply = response.data.reply;
      console.log('AI Reply:', reply);
      setMessagesState((prev) => [...prev, reply]);

      if (reply.audioBase64) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(reply.audioBase64), (c) => c.charCodeAt(0))],
          { type: 'audio/mp3' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch((err) => {
          console.error('Audio playback error:', err);
          axios.post('http://localhost:3001/api/auth/log', {
            userId: user.uid,
            intent: 'audio_playback_error',
            response: `Failed to play audio: ${err.message}`,
            userData: { context: 'chat_audio', steps: 9815 },
          });
        });
        audio.onended = () => URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      setMessagesState((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Oops, my signal’s weak. Try again, my heart? 😘',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <div className=" ml-auto mr-20 h-full flex flex-col relative overflow-hidden p-6">
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-20">
        {messagesState.map((msg, index) => {
          const previousTimestamp = index > 0 ? messagesState[index - 1].timestamp : undefined;
          return <ChatMessage key={index} message={msg} previousTimestamp={previousTimestamp} />;
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center p-3 bg-gray-900 rounded-xl ">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="What's on your mind?"
          className="flex-1 bg-gray-900 text-white px-4 py-2 resize-none min-h-[40px] max-h-[120px] focus:outline-none  transition-all duration-300 ease-in-out placeholder:text-gray-400/70 focus:outline-none focus:border-none"
        />
        <button
          onClick={handleSendMessage}
          className="ml-2 bg-lavender text-white rounded-full px-4 py-2 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender/50 transition-all duration-300 ease-in-out"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
