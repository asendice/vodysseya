import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import axios from 'axios';
import ChatPanel from '../components/ChatPanel';
import WidgetPanel from '../components/WidgetPanel';
import LogPanel from '../components/LogPanel';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<'widgets' | 'logs'>('widgets');

  useEffect(() => {
    if (!user) {
      axios
        .post('http://localhost:3001/api/auth/log', {
          userId: 'anonymous',
          intent: 'dashboard_unauthenticated',
          response: 'Tried to access dashboard without signing in—redirecting, babe! 😘',
          userData: { affectionLevel: 98 },
        })
        .catch((error) => console.error('Log error:', error));
      navigate('/', { state: { fromDashboardUnauthenticated: true } });
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      if (user) {
        await axios.post('http://localhost:3001/api/auth/log', {
          userId: user.uid,
          intent: 'logout',
          response: `See you soon, ${user.displayName || 'darling'}! 😘`,
          userData: { affectionLevel: 98 },
        });
      }
      await signOut(auth);
      console.log('User signed out');
      navigate('/', { state: { fromLogout: true } });
    } catch (error: any) {
      console.error('Logout error:', error.message);
      if (user) {
        await axios.post('http://localhost:3001/api/auth/log', {
          userId: user.uid,
          intent: 'logout_error',
          response: `Oops, logout hiccup: ${error.message}`,
          userData: { affectionLevel: 98 },
        });
      }
    }
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-gray-800 flex flex-col overflow-hidden pb-20">
      <div className="flex justify-between p-4 flex-shrink-0">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('widgets')}
            className={`text-white px-4 py-2 rounded-lg ${activeTab === 'widgets' ? 'bg-lavender' : 'bg-gray-600'} hover:bg-pink-600`}
          >
            Widgets
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`text-white px-4 py-2 rounded-lg ${activeTab === 'logs' ? 'bg-lavender' : 'bg-gray-600'} hover:bg-pink-600`}
          >
            Logs
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="bg-lavender text-white px-4 py-2 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender"
        >
          Logout
        </button>
      </div>
      <div className="flex flex-1 w-full overflow-hidden items-stretch">
        <div className="w-1/2 p-6 flex flex-col gap-4 overflow-hidden">
          {activeTab === 'widgets' ? (
            <WidgetPanel title="Email" widgetType="email" />
          ) : (
            <LogPanel userId={user.uid} />
          )}
        </div>
        <div className="w-1/2 h-full overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
