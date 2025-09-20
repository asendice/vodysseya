const googleSignIn = async (credential: string | undefined) => {
  try {
    // TODO: Verify credential with backend or Google API
    // Store tokens in Firebase (encrypted)
    console.log('Gmail connected with credential:', credential);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export default { googleSignIn };
