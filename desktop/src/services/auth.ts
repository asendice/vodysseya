const googleSignIn = async (credential: any) => {
  try {
    const response = await fetch('http://localhost:3001/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await response.json();
    console.log(data, 'data from backend');
    if (data.tokens) {
      console.log('Tokens received:', data.tokens);
      // TODO: Store in Firebase (encrypted)
      return { success: true };
    }
    throw new Error('No tokens received');
  } catch (error) {
    throw new Error(
      'Failed to connect Gmail: ' + (error instanceof Error ? error.message : String(error))
    );
  }
};
export default { googleSignIn };
