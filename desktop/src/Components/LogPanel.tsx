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

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`http://localhost:3001/api/logs/${userId}`);
      setLogs(response.data.logs);
    } catch (err: any) {
      setError(err.message || 'Logs are hiding—refresh, my love? 😘');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  const filteredLogs = logs.filter(
    (log) =>
      log.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.response.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <p className="text-white">Loading our memories... 💖</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const handleDeleteLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/api/logs/delete', {
        userId,
      });
      if (response.status === 200) {
        setLogs([]);
        alert('Last 100 logs deleted successfully.');
        setError(null);
      }
    } catch (err: any) {
      setError("Oops, couldn't delete logs. Let me try again for you...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-700 p-4 rounded-lg overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Logs</h2>
          <span
            className="bg-gray-800 text-white px-2 py-1 rounded-lg text-sm font-semibold"
            title="Log count"
          >
            {filteredLogs.length}
          </span>
        </div>
        <div>
          <button
            onClick={fetchLogs}
            className="ml-2 px-3 py-1 bg-lavender text-gray-900 rounded-lg hover:bg-lavender-600 transition-colors focus:outline-none focus:ring-2 focus:ring-lavender"
            title="Refresh logs"
            disabled={loading}
          >
            &#x21bb; Refresh
          </button>
          <button
            onClick={handleDeleteLogs}
            className="ml-2 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            title="Delete last 100 logs"
            disabled={loading}
          >
            Delete Logs
          </button>
        </div>
      </div>
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
