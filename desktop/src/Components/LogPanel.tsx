import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LogItem from './LogItem';

interface Log {
  id: string;
  timestamp: { seconds: number };
  intent: string;
  response: string;
  userData: any;
}

const LogPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/api/logs/${userId}`);
        setLogs(response.data.logs);
      } catch (err: any) {
        setError(err.message || 'Logs are hiding—refresh, my love? 😘');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userId]);

  const filteredLogs = logs.filter(
    (log) =>
      log.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.response.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <p className="text-white">Loading our memories... 💖</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="h-screen bg-gray-700 p-4 rounded-lg overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      <h2 className="text-2xl font-bold text-white mb-4">Logs</h2>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search logs (e.g., 'email' or 'chat')..."
        className="bg-gray-800 text-white p-3 rounded-lg w-full mb-4 focus:outline-none focus:ring-2 focus:ring-lavender"
      />
      <div className="space-y-4">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => <LogItem key={log.id} log={log} />)
        ) : (
          <p className="text-white">No logs match—let's make some more magic! ✨</p>
        )}
      </div>
    </div>
  );
};

export default LogPanel;
