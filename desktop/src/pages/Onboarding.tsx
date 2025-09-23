import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { auth } from '../firebase';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import axios from 'axios';

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already signed in or just signed out
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log('User already signed in:', user.uid);
        try {
          // Check for gmail_token via backend
          const response = await axios.get(
            `http://localhost:3001/api/auth/check-gmail-token/${user.uid}`
          );
          if (response.data.hasGmailToken) {
            navigate('/dashboard');
          } else {
            await axios.post('http://localhost:3001/api/auth/log', {
              userId: user.uid,
              intent: 'redirect_to_gmail_step',
              response: `Redirecting to connect Gmail for ${user.displayName || 'darling'}—let's peek at those emails! 💖`,
              userData: { affectionLevel: 98 },
            });
            setStep(3);
          }
        } catch (error) {
          console.error('Check gmail_token error:', error);
          setError('Oops, something’s off—try again, my love? 😘');
        }
      } else {
        const intent = location.state?.fromLogout
          ? 'show_signin_after_logout'
          : location.state?.fromChatUnauthenticated
            ? 'show_signin_after_unauthenticated_chat'
            : location.state?.fromEmailWidget
              ? 'show_signin_from_email_widget'
              : 'show_signin';
        try {
          await axios.post('http://localhost:3001/api/auth/log', {
            userId: 'anonymous',
            intent,
            response:
              intent === 'show_signin_after_logout'
                ? 'Showing sign-in screen after logout—ready to reconnect, babe! 😘'
                : intent === 'show_signin_after_unauthenticated_chat'
                  ? 'Got excited to chat, babe? Sign in first! 😘'
                  : intent === 'show_signin_from_email_widget'
                    ? 'Need Gmail to fetch emails, darling—sign in first! 😘'
                    : 'Showing sign-in screen—let’s get started, darling! 😘',
            userData: { affectionLevel: 98 },
          });
        } catch (error) {
          console.error('Log error:', error);
        }
      }
    });
    return () => unsubscribe();
  }, [navigate, location]);

  // Google OAuth for Sign-In or Gmail permissions
  const googleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        setError(null);
        console.log('Google OAuth code response:', codeResponse);

        // Determine scopes based on step
        const isGmailStep = step === 3;
        const scope = isGmailStep
          ? 'profile email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify'
          : 'profile email';

        // Send auth code to backend
        const response = await axios.post('http://localhost:3001/api/auth/google', {
          userId: auth.currentUser?.uid || 'anonymous',
          code: codeResponse.code,
          displayName: auth.currentUser?.displayName || '',
          scope,
        });

        const { id_token } = response.data;
        if (!id_token) throw new Error('No ID token returned from backend');

        // Sign in with Firebase (only for initial sign-in)
        if (!isGmailStep) {
          const credential = GoogleAuthProvider.credential(id_token);
          const userCredential = await signInWithCredential(auth, credential);
          const user = userCredential.user;

          // Update user profile
          await axios.post('http://localhost:3001/api/auth/update-profile', {
            userId: user.uid,
            displayName: user.displayName || '',
          });

          // Check if user exists
          const checkResponse = await axios.get(
            `http://localhost:3001/api/auth/check-user/${user.uid}`
          );
          if (checkResponse.data.exists) {
            // Check for gmail_token
            const tokenResponse = await axios.get(
              `http://localhost:3001/api/auth/check-gmail-token/${user.uid}`
            );
            if (tokenResponse.data.hasGmailToken) {
              navigate('/dashboard');
            } else {
              await axios.post('http://localhost:3001/api/auth/log', {
                userId: user.uid,
                intent: 'redirect_to_gmail_step',
                response: `Redirecting to connect Gmail for ${user.displayName || 'darling'}—let's peek at those emails! 💖`,
                userData: { affectionLevel: 98 },
              });
              setStep(3);
            }
          } else {
            setUserName(user.displayName || '');
            setStep(1);
          }
        } else {
          // Gmail permissions granted
          await axios.post('http://localhost:3001/api/auth/log', {
            userId: auth.currentUser?.uid,
            intent: 'gmail_connected',
            response: `Gmail connected—now I can whisper your emails to you, my heart! 💖`,
            userData: { affectionLevel: 98 },
          });
          setStep(4);
        }
      } catch (error: any) {
        console.error('Google sign-in error:', error);
        setError('Oops, sign-in hiccup! Try again, my love? 😘');
        await axios.post('http://localhost:3001/api/auth/log', {
          userId: auth.currentUser?.uid || 'anonymous',
          intent: isGmailStep ? 'gmail_auth_error' : 'google_signin_error',
          response: `Sign-in failed: ${error.message}`,
          userData: { affectionLevel: 98 },
        });
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', JSON.stringify(error, null, 2));
      setError('Failed to connect with Google—try again, darling? 😘');
      axios
        .post('http://localhost:3001/api/auth/log', {
          userId: auth.currentUser?.uid || 'anonymous',
          intent: step === 3 ? 'gmail_oauth_error' : 'google_oauth_error',
          response: `Google OAuth failed: ${JSON.stringify(error, null, 2)}`,
          userData: { affectionLevel: 98 },
        })
        .catch((logError) => console.error('Log error:', logError));
    },
    flow: 'auth-code',
    scope:
      step === 3
        ? 'profile email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify'
        : 'profile email',
    ux_mode: 'popup',
    access_type: 'offline',
    prompt: 'consent',
  });

  const steps = [
    // Step 0: Sign-In or Sign-Up
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-4xl font-bold text-white mb-6">
        {location.state?.fromLogout
          ? 'Missed you, babe! Sign in again? 😘'
          : location.state?.fromChatUnauthenticated
            ? 'Got excited to chat, babe? Sign in first! 😘'
            : location.state?.fromEmailWidget
              ? 'Need Gmail to fetch emails, darling—sign in first! 😘'
              : 'Hey, I’m Ani. Ready to join Odyssey, darling? 💖'}
      </h1>
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4 animate-pulse">{error}</div>
      )}
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender"
        onClick={() => googleLogin()}
      >
        Sign in with Google
      </button>
    </div>,

    // Step 1: Ask Name (for new users)
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-deep-blue to-gray-dark p-8 rounded-lg">
      <h1 className="text-3xl font-bold text-white mb-6">What’s your preferred name?</h1>
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
            const user = auth.currentUser;
            if (user) {
              await axios.post('http://localhost:3001/api/auth/update-profile', {
                userId: user.uid,
                displayName: userName,
              });
              setStep(2);
            }
          } catch (error: any) {
            console.error('Profile update error:', error.message);
            setError('Failed to save your name—try again, my heart? 😘');
            await axios.post('http://localhost:3001/api/auth/log', {
              userId: auth.currentUser?.uid || 'anonymous',
              intent: 'profile_update_error',
              response: `Profile update failed: ${error.message}`,
              userData: { affectionLevel: 98 },
            });
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
        Odyssey is your all-in-one AI companion—I’ll track habits, glimpse emails, and more. We need
        some info to personalize (like your name)—all encrypted. Tap to continue!
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
        To sync your emails, I’ll need a tap. Promise it’s secure! 🔒
      </h1>
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4 animate-pulse">{error}</div>
      )}
      <button
        className="bg-lavender text-white px-6 py-3 rounded-lg hover:bg-pink-600"
        onClick={() => googleLogin()}
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
      <h1 className="text-3xl font-bold text-white mb-6">All set, {userName}! Let’s dive in.</h1>
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
