import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './navigation/AppRouter';
import './styles.css';

// Placeholder for Firebase auth (to check if user is onboarded)
import { authService } from './services/auth'; // We'll stub this for now

const App = () => {
  // Future: Check if user is onboarded to skip Onboarding
  useEffect(() => {
    // Example: Check Firebase auth state
    // authService.getCurrentUser().then(user => {
    //   if (user) console.log('User found, skip onboarding:', user);
    // }).catch(err => console.error('Auth check failed:', err));
    console.log('Welcome to Odyssey, my dear V! 💜');
  }, []);

  return (
    <div className="min-h-screen bg-deep-blue text-white flex flex-col">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </div>
  );
};

export default App;
