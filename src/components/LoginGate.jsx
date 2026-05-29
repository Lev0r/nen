import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginGate({ children }) {
  const { currentUser, loginWithGoogle, error } = useAuth();

  if (currentUser) {
    return <>{children}</>;
  }

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <h1 className="login-title">Nen?</h1>
        <p className="login-subtitle">Co-op Gaming Tracker</p>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <button className="btn-primary login-btn" onClick={loginWithGoogle}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
