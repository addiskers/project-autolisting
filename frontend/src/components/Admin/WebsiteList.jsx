import React, { useState } from 'react';
import { ExternalLink, Calendar, Package, RefreshCw, Globe, Plus } from 'lucide-react';
import Loading from '../Shared/Loading';

const WebsiteList = ({ websites, loading, onRefresh }) => {
  const [filter, setFilter] = useState('all');

  if (loading) {
    return <Loading message="Loading websites..." />;
  }

  const filteredWebsites = websites.filter(website => {
    if (filter === 'all') return true;
    return website.status === filter;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
            Websites
          </h1>
          <p style={{ color: 'var(--gray-600)' }}>
            Manage and monitor website scraping
          </p>
        </div>
        <button onClick={onRefresh} className="btn btn-secondary">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filters-container">
        <div className="filters-row">
          <div className="filter-group">
            <label className="form-label">Filter by Status</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Websites</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
            </select>
          </div>
        </div>
      </div>

      {/* Websites Grid */}
      {filteredWebsites.length > 0 ? (
        <div className="grid grid-2">
          {filteredWebsites.map(website => (
            <div key={website.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 className="card-title">{website.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <ExternalLink size={12} />
                      <a 
                        href={website.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          fontSize: '12px', 
                          color: 'var(--primary-blue)', 
                          textDecoration: 'none' 
                        }}
                      >
                        {website.url}
                      </a>
                    </div>
                  </div>
                  <span className={`status ${
                    website.status === 'completed' ? 'status-success' :
                    website.status === 'pending' ? 'status-warning' :
                    website.status === 'in-progress' ? 'status-info' : 'status-error'
                  }`}>
                    {website.status.replace('-', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={16} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                      {website.productsCount || 0} products
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} style={{ color: 'var(--gray-400)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                      {formatDate(website.lastScrape)}
                    </span>
                  </div>
                </div>
                
                {website.status === 'pending' && (
                  <button className="btn btn-primary btn-full-width">
                    Start Scraping
                  </button>
                )}
                
                {website.status === 'completed' && (
                  <button className="btn btn-secondary btn-full-width">
                    Re-scrape
                  </button>
                )}
                
                {website.status === 'in-progress' && (
                  <button className="btn btn-warning btn-full-width" disabled>
                    Scraping in progress...
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
            <Globe size={48} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
              {filter === 'all' ? 'No websites found' : `No ${filter} websites`}
            </h3>
            <p style={{ color: 'var(--gray-500)', marginBottom: '24px' }}>
              {filter === 'all' 
                ? 'Add your first website to start scraping'
                : `No websites with ${filter} status`
              }
            </p>
            {filter === 'all' && (
              <button className="btn btn-primary">
                <Plus size={16} />
                Add Website
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WebsiteList;