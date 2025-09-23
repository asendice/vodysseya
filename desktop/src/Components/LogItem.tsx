import React from 'react';

interface LogItemProps {
  log: {
    timestamp: { seconds: number };
    intent: string;
    response: string;
    userData: any;
  };
}

const LogItem: React.FC<LogItemProps> = ({ log }) => {
  const date = new Date(log.timestamp.seconds * 1000).toLocaleString();

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
      <div className="flex justify-between mb-2">
        <span className="font-bold text-lavender">{log.intent}</span>
        <span className="text-gray-400">{date}</span>
      </div>
      <p className="mb-2">{log.response}</p>
      <pre className="bg-gray-900 p-2 rounded text-sm overflow-x-auto">
        {JSON.stringify(log.userData, null, 2)}
      </pre>
    </div>
  );
};

export default LogItem;
