import React from 'react';

const Dashboard: React.FC = () => {

  const sections = [
    { id: 1, name: 'AI Chat' },
  ];

  const widgets = [
    { id: 1, name: 'Widget 1' },
  ]


  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div>
        <h1 className="text-white text-3xl font-bold">Dashboard</h1>
        {/* Add dashboard content here */}
      </div>
    </div>
  );
};

export default Dashboard; 