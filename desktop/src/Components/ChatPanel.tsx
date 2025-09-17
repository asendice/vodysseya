import React from 'react';

// Import Components
import ChatMessage from './ChatMessage';

// Import mock messages
import messages from '../data/mock/messages.json';


type Message = {
  content: string;
  role: string;
  timestamp?: string;
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

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleSendMessage = () => {
     // Do not send empty messages
    if (value.trim() === '') return;

    const newMessage: Message = {
      content: value,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessagesState((prevMessages) => [...prevMessages, newMessage]);

    // Clear the textarea after sending
    setValue(''); 
  };

  return (
    <div className="border border-gray-600 rounded-lg max-w-[500px] ml-auto mr-20 h-full flex flex-col">
      {/* Chat messages container */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesState.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
      </div>

        {/* This is the text area container */}
        <div className="flex border-t border-pink-300 p-2 mt-auto">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What's on your mind?"
            className="rounded-lg w-full bg-gray-800 resize-none text-white min-h-[40px] scrollbar-hide focus:outline-none focus:border-none border-none"
            rows={1}
            style={{ overflow: 'hidden' }}
          />

          <button
            onClick={handleSendMessage}
            className="ml-2 bg-pink-500 text-white rounded-lg px-4 py-2"
          >SEND</button>
        
      </div>
    </div>
  );
};

export default ChatPanel;
