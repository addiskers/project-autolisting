import React from 'react';
import { Globe, CheckCircle, Clock, Package, RefreshCw } from 'lucide-react';
import Loading from '../Shared/Loading';

const Dashboard = ({ websites, stats, loading, onRefresh }) => {
  if (loading) {
    return <Loading message="Loading dashboard..." />;
  }

  const recentWebsites = websites
    .sort((a, b) => new Date(b.lastScrape || 0) - new Date(a.lastScrape || 0))
    .slice(0, 5);

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--gray-600)' }}>
            Manage websites and monitor scraping operations
          </p>
        </div>
        <button onClick={onRefresh} className="btn btn-secondary">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4" style={{ marginBottom: '32px' }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Globe size={32} style={{ color: 'var(--primary-blue)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.totalWebsites}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Total Websites
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.completedWebsites}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Completed
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Clock size={32} style={{ color: 'var(--warning)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.pendingWebsites}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Pending
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Package size={32} style={{ color: 'var(--accent-blue)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.totalProducts.toLocaleString()}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Total Products
            </div>
          </div>
        </div>
      </div>

      {/* Recent Websites */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Websites</h3>
          <p className="card-subtitle">Latest website scraping activity</p>
        </div>
        <div className="card-body" style={{ padding: '0' }}>
          {recentWebsites.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentWebsites.map((website, index) => (
                <div 
                  key={website.id} 
                  style={{ 
                    padding: '16px 24px',
                    borderBottom: index < recentWebsites.length - 1 ? '1px solid var(--gray-100)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      {website.name}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                      {website.url}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`status ${
                      website.status === 'completed' ? 'status-success' :
                      website.status === 'pending' ? 'status-warning' :
                      website.status === 'in-progress' ? 'status-info' : 'status-error'
                    }`} style={{ marginBottom: '4px' }}>
                      {website.status.replace('-', ' ')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {website.productsCount || 0} products
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-500)' }}>
              No websites added yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;