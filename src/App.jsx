import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginGate from './components/LoginGate';
import './App.css';

function Dashboard() {
  const { currentUser, userIndex, logout } = useAuth();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header glass-panel">
        <h2>Nen? Tracker</h2>
        <div className="user-info">
          <span>Logged in as User {userIndex} ({currentUser.email})</span>
          <button className="btn-secondary" onClick={logout}>Sign Out</button>
        </div>
      </header>
      <main className="dashboard-main">
        <p>Welcome to the Dashboard. Game library will be loaded here.</p>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <Dashboard />
      </LoginGate>
    </AuthProvider>
  );
}

export default App;
