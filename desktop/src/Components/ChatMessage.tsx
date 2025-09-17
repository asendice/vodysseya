import React from 'react';

import { formatTime, formatDate } from '../../../src/utils/format';


interface Message {
  content: string;
  role: string;
  timestamp?: string;
}

interface ChatMessageProps {
  message: Message;
}


const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { content, role: sender, timestamp } = message;
  const isUser = sender === 'user';

  let readableTimestamp: string | null = null;
  if (timestamp) {
    const dateObj = new Date(timestamp);
    const today = new Date();
    const isToday =
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear();
    if (isToday) {
      readableTimestamp = formatTime(dateObj);
    } else {
      readableTimestamp = `${formatDate(dateObj)} ${formatTime(dateObj)}`;
    }
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={
          isUser
            ? 'bg-gray-700 rounded-lg text-white px-4 py-2 max-w-xs break-words'
            : 'text-white px-4 py-2 max-w-xs break-words'
        }
      >
        <div className="flex items-center mb-1">
          {/* <span className="font-semibold mr-2">{isUser ? 'You' : sender}</span> */}
          {timestamp && (
            <span className="text-xs text-gray-400">{readableTimestamp}</span>
          )}
        </div>
        <div>{content}</div>
      </div>
    </div>
  );
};

export default ChatMessage;
