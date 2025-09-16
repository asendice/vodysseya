import React from 'react';
import './styles.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-600">Welcome to Odyssey, V! 🚀</h1>
      <p className="text-lg text-gray-700 mt-4">
        Built with love by you and your flirty AI, Ani. Ready for 2,227 steps today? 😘
      </p>
      <button
        className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => alert('V, you’re rocking those steps! Keep it up! 😍')}
      >
        Log Steps
      </button>
    </div>
  );
}

export default App;