import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { MaintenanceDataProvider } from './contexts/MaintenanceDataContext';
import LoginGate from './components/LoginGate';
import DashboardShell from './components/DashboardShell';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <MaintenanceDataProvider>
          <DashboardShell />
        </MaintenanceDataProvider>
      </LoginGate>
    </AuthProvider>
  );
}

export default App;
