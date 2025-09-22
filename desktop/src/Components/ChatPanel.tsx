import React from 'react';
import axios from 'axios';
import { auth } from '../firebase';

// Import Components
import ChatMessage from './ChatMessage';

// Import mock messages
import messages from '../data/mock/messages.json';

type Message = {
  content: string;
  role: string;
  timestamp?: string;
  audioBase64?: string; // Added for ElevenLabs audio
};

type ChatPanelProps = {
  title?: string;
  messages?: Message[];
};

const ChatPanel: React.FC<ChatPanelProps> = ({ title = 'Chat Panel' }) => {
  const [value, setValue] = React.useState('');
  const [messagesState, setMessagesState] = React.useState<Message[]>(
    messages.map((msg: any) => ({
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
    }))
  );
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const user = auth.currentUser;

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesState]);

  const handleSendMessage = async () => {
    if (value.trim() === '') return;
    const newMessage: Message = {
      content: value,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessagesState((prevMessages) => [...prevMessages, newMessage]);
    setValue('');

    try {
      const response = await axios.post('http://localhost:3001/api/chat', {
        userId: user?.uid,
        message: value,
      });
      const reply = response.data.reply;
      console.log('AI Reply:', reply);
      setMessagesState((prev) => [...prev, reply]);

      // Play audio if present (desktop auto-play)
      if (reply.audioBase64) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(reply.audioBase64), (c) => c.charCodeAt(0))],
          { type: 'audio/mp3' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch((err) => {
          console.error('Audio playback error:', err);
          // Log to Firebase (simplified, assumes a log function)
          axios.post('http://localhost:3001/api/log', {
            userId: user?.uid,
            intent: 'audio_playback_error',
            response: `Failed to play audio: ${err.message}`,
            userData: { context: 'chat_audio', steps: 9815 },
          });
        });
        // Cleanup Blob URL after playback
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
    <div className="border border-gray-600 rounded-lg max-w-[600px] ml-auto mr-20 h-full flex flex-col relative">
      {/* Chat messages container */}
      <div className="flex-1 overflow-y-scroll p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 scrollbar scrollbar-thumb-transparent pb-20">
        {messagesState.map((msg, index) => {
          const previousTimestamp = index > 0 ? messagesState[index - 1].timestamp : undefined;
          return <ChatMessage key={index} message={msg} previousTimestamp={previousTimestamp} />;
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed SEND button and textarea container */}
      <div className="flex border-t border-pink-300 p-2 bg-gray-800 rounded-b-lg absolute bottom-0 left-0 w-full">
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
          placeholder="What's on your mind, babe?"
          className="rounded-lg w-full bg-gray-800 resize-none text-white min-h-[40px] focus:outline-none focus:border-none border-none"
          rows={1}
          style={{ overflow: 'hidden' }}
        />

        <button
          onClick={handleSendMessage}
          className="ml-2 bg-pink-500 text-white rounded-lg px-4 py-2 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 h-10 mt-auto"
        >
          SEND
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
