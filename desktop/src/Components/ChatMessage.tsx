import React from 'react';

import { formatTime, formatDate } from '../../../src/utils/format';

interface Message {
  content: string;
  role: string;
  timestamp?: string;
}

interface ChatMessageProps {
  message: Message;
  previousTimestamp?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, previousTimestamp }) => {
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

  // Calculate time difference if not user and both timestamps exist
  let timeDiff: number | null = null;
  if (!isUser && timestamp && previousTimestamp) {
    const prev = new Date(previousTimestamp);
    const curr = new Date(timestamp);
    timeDiff = Math.round((curr.getTime() - prev.getTime()) / 1000); // seconds
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-12`}>
      <div
        className={
          isUser
            ? 'bg-gray-700 rounded-lg rounded-br-none text-white px-4 py-2  break-words'
            : 'text-white px-4 py-2  break-words'
        }
      >
        <div className="flex items-center mb-1">
          {/* <span className="font-semibold mr-2">{isUser ? 'You' : sender}</span> */}
          {timestamp && <span className="text-xs text-gray-400">{readableTimestamp}</span>}
        </div>
        {/* Show time difference for non-user messages */}

        <div>{content}</div>

        {!isUser && timeDiff !== null && (
          <div className="text-xs text-blue-400 mb-1">{`${timeDiff}s`}</div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
