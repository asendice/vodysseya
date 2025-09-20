import React from 'react';

// Import Elements for Dashboard
import ChatPanel from '../components/ChatPanel';
import WidgetContainer from '../components/WidgetContainer';

const Dashboard: React.FC = () => {
  const widgets = [{ id: 1, name: 'Widget 1' }];

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col">
      {/* Remove this H1 Later */}
      {/* <h1 className="text-white text-3xl font-bold">Dashboard</h1> */}

      {/* This div will be the main container for dashboard content */}
      <div className="w-full flex">
        <div className="flex-1">
          <WidgetContainer title="My First Widget" />
        </div>
        <div className="w-full h-screen">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
