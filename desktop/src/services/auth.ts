import axios from 'axios';
import { auth } from '../firebase'; // Adjust path to your firebaseConfig.ts

const googleSignIn = async (code: string): Promise<{ success: boolean }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user signed in—start with Google, darling! 😘');
  }

  console.log('Current user:', user);
  const userId = user.uid;

  try {
    // Send code to backend
    const response = await axios.post(
      'http://localhost:3001/api/auth/google',
      {
        userId,
        code,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const data = response.data;

    if (data.success) {
      console.log('Tokens stored by backend:', data.message);
      // Log to Ani Log via chat API
      await axios.post('http://localhost:3001/api/chat', {
        userId,
        message: 'Gmail connected—peeking with you',
      });
      return { success: true };
    }
    throw new Error('No tokens received from backend');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Gmail auth error:', errorMessage);
    // Log error to Ani Log
    await axios.post('http://localhost:3001/api/chat', {
      userId,
      message: `Failed to connect Gmail—try again (${errorMessage})`,
    });
    throw new Error(`Failed to connect Gmail: ${errorMessage}`);
  }
};

export default { googleSignIn };
