import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import axios from 'axios';

// Import Elements for Dashboard
import ChatPanel from '../components/ChatPanel';
import WidgetContainer from '../components/WidgetContainer';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Redirect to sign-in if user is not authenticated
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

  if (!user) return null; // Prevent rendering until redirect

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col">
      {/* Logout Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="bg-lavender text-white px-4 py-2 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender"
        >
          Logout
        </button>
      </div>

      {/* Main Dashboard Content */}
      <div className="w-full flex">
        <div className="w-full p-6">
          <WidgetContainer title="Email" widgetType="email" />
        </div>
        <div className="w-full h-screen">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
