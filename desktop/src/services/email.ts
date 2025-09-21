import axios from 'axios';
import { auth } from '../firebase';

const API_URL = 'http://localhost:3001/api/email';

export const fetchEmails = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user signed in');
  }

  try {
    const response = await axios.get(`${API_URL}/${user.uid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};
