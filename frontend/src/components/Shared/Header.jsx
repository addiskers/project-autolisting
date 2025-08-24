// frontend/src/components/Shared/Header.jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Database } from 'lucide-react';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">
          <Database size={24} style={{ marginRight: '8px' }} />
          Web Scraper
        </h1>
      </div>
      
      <div className="header-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              {user?.name || user?.username}
            </span>
            <span 
              className="status status-info" 
              style={{ marginLeft: '8px', fontSize: '10px' }}
            >
              {user?.role}
            </span>
          </div>
          
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '13px' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

