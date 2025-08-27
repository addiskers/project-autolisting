import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, User, Lock } from 'lucide-react';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    role: 'user'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, error, clearError, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Clear errors when component unmounts or credentials change
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      return;
    }

    setIsLoading(true);
    
    try {
      await login(credentials);
      // Navigation will happen automatically via useEffect
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'admin') {
      setCredentials({
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
    } else {
      setCredentials({
        username: 'user',
        password: 'user123',
        role: 'user'
      });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-title">
          Prodcut Management  Dashboard
        </div>
        
        {error && (
          <div className="error-message" style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              name="role"
              value={credentials.role}
              onChange={handleChange}
              className="form-select"
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your username"
                required
                style={{ paddingLeft: '40px' }}
              />
              <User 
                size={16} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--gray-400)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your password"
                required
                style={{ paddingLeft: '40px' }}
              />
              <Lock 
                size={16} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--gray-400)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full-width btn-large"
            disabled={isLoading || !credentials.username || !credentials.password}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Login Demo Buttons */}
        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--gray-200)' }}>
          <div style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '12px', textAlign: 'center' }}>
            Quick Demo Login:
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Admin Demo
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('user')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              User Demo
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '8px', textAlign: 'center' }}>
            Admin: admin/admin123 | User: user/user123
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;