// services/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@user_auth_token';

// 1. Save token (Use in LoginScreen & SignupScreen)
export const saveToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.error('Error saving token', e);
  }
};

// 2. Read token (Use in App.js to check if already logged in)
export const getToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.error('Error reading token', e);
    return null;
  }
};

// 3. Delete token (Use in ProfileScreen for logging out)
export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('Error removing token', e);
  }
};