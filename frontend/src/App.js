import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/Auth/PrivateRoute';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import './styles/globals.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected Routes - Added /* wildcards for nested routing */}
            <Route
              path="/admin/*"
              element={
                <PrivateRoute roles={['admin']}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            
            <Route
              path="/dashboard/*"
              element={
                <PrivateRoute roles={['user', 'admin']}>
                  <UserDashboard />
                </PrivateRoute>
              }
            />
            
            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch All */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;