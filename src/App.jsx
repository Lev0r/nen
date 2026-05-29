import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import LoginGate from './components/LoginGate';
import DashboardShell from './components/DashboardShell';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <DashboardShell />
      </LoginGate>
    </AuthProvider>
  );
}

export default App;
