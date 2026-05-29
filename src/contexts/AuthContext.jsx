import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userIndex, setUserIndex] = useState(null); // 0 or 1
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const ALLOWED_EMAILS = [
    import.meta.env.VITE_ALLOWED_EMAIL_0,
    import.meta.env.VITE_ALLOWED_EMAIL_1
  ];

  const loginWithGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login failed:', err);
      setError('Failed to log in with Google.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === ALLOWED_EMAILS[0]) {
          setUserIndex(0);
          setCurrentUser(user);
          setError('');
        } else if (user.email === ALLOWED_EMAILS[1]) {
          setUserIndex(1);
          setCurrentUser(user);
          setError('');
        } else {
          // Unauthorized email
          await signOut(auth);
          setCurrentUser(null);
          setUserIndex(null);
          setError('Access denied. Your email is not authorized for this app.');
        }
      } else {
        setCurrentUser(null);
        setUserIndex(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userIndex,
    loginWithGoogle,
    logout,
    error,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
