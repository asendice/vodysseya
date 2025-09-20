import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'; // Add GoogleOAuthProvider
import authService from '../services/auth';
import { auth } from '../firebase'; // Adjust path to your firebaseConfig.ts
import { signInAnonymously } from 'firebase/auth';

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  // In Onboarding.tsx, before signInAnonymously
  console.log('Firebase config:', {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
  });

  // Google OAuth for Gmail permissions
  const googleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        console.log('Google OAuth code response:', codeResponse);
        await authService.googleSignIn(codeResponse.code); // Send auth code
        setStep(4);
      } catch (error) {
        console.error('Gmail auth error:', error);
      }
    },
    onError: (error) => {
      console.error('Login Failed:', error);
    },
    flow: 'auth-code',
    scope:
      'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify', // Per ODYSSEY.md for Email Glimpse
    ux_mode: 'popup',
    access_type: 'offline', // For refresh_token
    prompt: 'consent', // Ensure consent for offline access
  });

  const steps = [
    // Step 0: Welcome
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-4xl font-bold text-white mb-6">
        Hey, I'm "companionName". Ready to make everyday feel special?
      </h1>
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender"
        onClick={() => setStep(1)}
      >
        Let's Go!
      </button>
    </div>,

    // Step 1: Ask Name
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">What's your preferred name?</h1>
      <input
        type="text"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="e.g., V"
        className="bg-gray-dark text-white p-3 rounded-lg w-64 mb-4 focus:outline-none focus:ring-2 focus:ring-lavender"
      />
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600 disabled:opacity-50"
        onClick={async () => {
          try {
            console.log('Signing in anonymously...');
            const userCredential = await signInAnonymously(auth);
            console.log('Anonymous user ID:', userCredential.user.uid);
            setStep(2);
          } catch (error: any) {
            console.error('Anon sign-in error:', error.message);
          }
        }}
        disabled={!userName}
      >
        Next
      </button>
    </div>,

    // Step 2: Explanation
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">What is Odyssey?</h1>
      <p className="text-lg text-white text-center mb-6 max-w-md">
        Odyssey is your all-in-one AI companion—I'll track habits, glimpse emails, and more. We need
        some info to personalize (like your name and permissions)—all encrypted. Tap to continue!
      </p>
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600"
        onClick={() => setStep(3)}
      >
        Got It
      </button>
    </div>,

    // Step 3: Permissions (Gmail Prompt)
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">
        To sync your emails, I'll need a tap. Promise it's secure! 🔒
      </h1>
      <button
        onClick={() => googleLogin()}
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600"
      >
        Connect Gmail
      </button>
      <button
        className="mt-4 text-gray-400 hover:text-white"
        onClick={() => navigate('/dashboard')}
      >
        Skip for Now
      </button>
    </div>,

    // Step 4: Final
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">All set, {userName}! Let's dive in.</h1>
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600"
        onClick={() => navigate('/dashboard')}
      >
        Start Odyssey
      </button>
    </div>,
  ];

  return <div>{steps[step]}</div>;
};

// Wrap Onboarding in GoogleOAuthProvider
const OnboardingWithProvider: React.FC = () => (
  <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
    <Onboarding />
  </GoogleOAuthProvider>
);

export default OnboardingWithProvider;
