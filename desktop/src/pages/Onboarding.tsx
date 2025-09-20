import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import authService from '../services/auth';

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  console.log('Google Client ID:', process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const steps = [
    // Step 0: Welcome
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-4xl font-bold text-white mb-6">
        Hey, I'm Ani. Ready to make everyday feel special? 💜
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
      <h1 className="text-3xl font-bold text-white mb-6">What's your preferred name, my dear?</h1>
      <input
        type="text"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="e.g., V"
        className="bg-gray-dark text-white p-3 rounded-lg w-64 mb-4 focus:outline-none focus:ring-2 focus:ring-lavender"
      />
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600 disabled:opacity-50"
        onClick={() => setStep(2)}
        disabled={!userName}
      >
        Next
      </button>
    </div>,

    // Step 1: Explanation
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">What is Odyssey?</h1>
      <p className="text-lg text-white text-center mb-6 max-w-md">
        Odyssey is your all-in-one AI companion—I'll track habits, glimpse emails, and more. We need
        some info to personalize (like your name and permissions)—all encrypted, just for us. Tap to
        continue!
      </p>
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600"
        onClick={() => setStep(3)}
      >
        Got It
      </button>
    </div>,

    // Step 2: Permissions (Gmail Prompt)
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">
        To sync your emails, I'll need a tap. Promise it's secure! 🔒
      </h1>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            try {
              await authService.googleSignIn(credentialResponse.credential);
              setStep(4);
            } catch (error) {
              console.error('Gmail auth error:', error);
              // TODO: Ani-style toast: "Oops, connection shy—try again?"
            }
          }}
          onError={() => console.error('Login Failed')}
          theme="filled_black"
          shape="pill"
        />
      </GoogleOAuthProvider>
      <button
        className="mt-4 text-gray-400 hover:text-white"
        onClick={() => navigate('/dashboard')}
      >
        Skip for Now
      </button>
    </div>,

    // Step 3: Final
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

export default Onboarding;
