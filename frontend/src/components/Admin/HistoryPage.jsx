import React, { useState, useEffect } from 'react';
import { scrapingAPI, handleAPIError } from '../../services/api';
import { History, Database, Download, CheckCircle, XCircle, Clock, Filter, RefreshCw, Activity } from 'lucide-react';
import Loading from '../Shared/Loading';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    type: '',
    vendor: '',
    status: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    loadHistory();
  }, [filters]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = {
        page: filters.page,
        limit: filters.limit
      };
      
      if (filters.type) params.type_filter = filters.type;
      if (filters.vendor) params.vendor_filter = filters.vendor;
      if (filters.status) params.status_filter = filters.status;

      const response = await scrapingAPI.getFetchHistory(params);
      
      setHistory(response.history || []);
      setStats(response.stats || {});
      setPagination({
        total: response.total || 0,
        hasNext: response.has_next || false,
        hasPrev: response.has_prev || false
      });
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      vendor: '',
      status: '',
      page: 1,
      limit: 20
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
      case 'running':
        return <Clock size={16} style={{ color: 'var(--warning)' }} />;
      case 'error':
        return <XCircle size={16} style={{ color: 'var(--danger)' }} />;
      default:
        return <Activity size={16} style={{ color: 'var(--gray-500)' }} />;
    }
  };

  const getTypeIcon = (type) => {
    return type === 'shopify' 
      ? <Database size={16} style={{ color: 'var(--accent-blue)' }} />
      : <Download size={16} style={{ color: 'var(--primary-blue)' }} />;
  };

  if (loading && history.length === 0) {
    return <Loading message="Loading fetch history..." />;
  }

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
            <History size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Fetch History
          </h1>
          <p style={{ color: 'var(--gray-600)' }}>
            Monitor all scraping and Shopify fetch operations
          </p>
        </div>
        <button onClick={loadHistory} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Activity size={32} style={{ color: 'var(--primary-blue)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.total_operations || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Total Operations
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Download size={32} style={{ color: 'var(--success)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.total_scrapes || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Website Scrapes
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <Database size={32} style={{ color: 'var(--accent-blue)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.total_shopify_fetches || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Shopify Fetches
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <CheckCircle size={32} style={{ color: 'var(--warning)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--gray-800)' }}>
              {stats.completed_today || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Completed Today
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} />
              <span style={{ fontWeight: '600' }}>Filters:</span>
            </div>

            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)' }}
            >
              <option value="">All Types</option>
              <option value="scrape">Website Scraping</option>
              <option value="shopify">Shopify Fetch</option>
            </select>

            <input
              type="text"
              placeholder="Filter by vendor..."
              value={filters.vendor}
              onChange={(e) => handleFilterChange('vendor', e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '6px', 
                border: '1px solid var(--gray-300)',
                minWidth: '150px'
              }}
            />

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)' }}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="error">Error</option>
            </select>

            {(filters.type || filters.vendor || filters.status) && (
              <button onClick={clearFilters} className="btn btn-secondary btn-small">
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Operations</h3>
          <p className="card-subtitle">
            Showing {history.length} of {pagination.total} operations
          </p>
        </div>
        
        <div className="card-body" style={{ padding: '0' }}>
          {history.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-100)' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Vendor</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Started</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Duration</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: index < history.length - 1 ? '1px solid var(--gray-100)' : 'none',
                        backgroundColor: index % 2 === 0 ? 'white' : 'var(--gray-50)'
                      }}
                    >
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getTypeIcon(item.type)}
                          <span style={{ textTransform: 'capitalize' }}>
                            {item.type === 'shopify' ? 'Shopify Fetch' : 'Website Scrape'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ 
                          padding: '4px 8px',
                          backgroundColor: 'var(--lighter-blue)',
                          color: 'var(--dark-blue)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          {item.name}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getStatusIcon(item.status)}
                          <span className={`status ${
                            item.status === 'completed' ? 'status-success' :
                            item.status === 'running' ? 'status-warning' :
                            item.status === 'error' ? 'status-danger' : 'status-info'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--gray-600)' }}>
                        {formatDate(item.started_at)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--gray-600)' }}>
                        {item.duration || 'N/A'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--gray-600)' }}>
                        {item.completed_at ? formatDate(item.completed_at) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-500)' }}>
              <History size={48} style={{ marginBottom: '16px' }} />
              <h3 style={{ marginBottom: '8px' }}>No history found</h3>
              <p>No fetch operations match your current filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total > filters.limit && (
          <div className="card-footer" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 24px'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Page {filters.page} of {Math.ceil(pagination.total / filters.limit)}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handlePageChange(filters.page - 1)}
                disabled={!pagination.hasPrev}
                className="btn btn-secondary btn-small"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(filters.page + 1)}
                disabled={!pagination.hasNext}
                className="btn btn-secondary btn-small"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;