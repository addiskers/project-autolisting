import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  Download,
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import { listingAPI } from '../../services/api';

const ListingHistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    vendor_filter: '',
    operation_filter: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    has_next: false,
    has_prev: false
  });

  useEffect(() => {
    loadListingHistory();
  }, [filters]);

  const loadListingHistory = async () => {
    setLoading(true);
    try {
      const response = await listingAPI.getListingHistory(filters);
      setHistory(response.history || []);
      setPagination({
        total: response.total || 0,
        has_next: response.has_next || false,
        has_prev: response.has_prev || false
      });
      setStats(response.stats || {});
    } catch (error) {
      console.error('Error loading listing history:', error);
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  const getSuccessRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (numRate >= 90) return 'var(--success)';
    if (numRate >= 70) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <ShoppingCart size={24} />
          Listing History
        </h1>
        <p className="page-subtitle">
          Track all Shopify product listing operations (individual and bulk)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4 summary-cards" style={{ marginBottom: '32px' }}>
        <div className="card">
          <div className="card-body summary-card-body">
            <Activity size={32} className="summary-icon primary-icon" />
            <h3 className="summary-number">
              {stats.total_operations?.toLocaleString() || 0}
            </h3>
            <p className="summary-label">
              Total Operations
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body summary-card-body">
            <CheckCircle size={32} className="summary-icon success-icon" />
            <h3 className="summary-number">
              {stats.total_successful_listings?.toLocaleString() || 0}
            </h3>
            <p className="summary-label">
              Products Listed
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body summary-card-body">
            <Clock size={32} className="summary-icon warning-icon" />
            <h3 className="summary-number">
              {stats.operations_today?.toLocaleString() || 0}
            </h3>
            <p className="summary-label">
              Today's Operations
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body summary-card-body">
            <Users size={32} className="summary-icon info-icon" />
            <h3 className="summary-number">
              {stats.vendor_breakdown?.length || 0}
            </h3>
            <p className="summary-label">
              Active Vendors
            </p>
          </div>
        </div>
      </div>

      {/* Vendor Breakdown */}
      {stats.vendor_breakdown && stats.vendor_breakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">Vendor Breakdown</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-2">
              {stats.vendor_breakdown.map(vendor => (
                <div key={vendor._id} className="vendor-stat-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {vendor._id}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {vendor.total_operations} operations
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--success)' }}>
                      ✓ {vendor.total_successful} successful
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--error)' }}>
                      ✗ {vendor.total_failed} failed
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                    Last: {formatTimestamp(vendor.last_operation)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '200px' }}>
              <label className="form-label">Vendor</label>
              <select
                value={filters.vendor_filter}
                onChange={(e) => handleFilterChange('vendor_filter', e.target.value)}
                className="form-select"
              >
                <option value="">All Vendors</option>
                <option value="phoenix">Phoenix</option>
                <option value="hansgrohe">Hansgrohe</option>
                <option value="moen">Moen</option>
                <option value="kohler">Kohler</option>
              </select>
            </div>

            <div style={{ minWidth: '150px' }}>
              <label className="form-label">Operation Type</label>
              <select
                value={filters.operation_filter}
                onChange={(e) => handleFilterChange('operation_filter', e.target.value)}
                className="form-select"
              >
                <option value="">All Types</option>
                <option value="single">Single Product</option>
                <option value="bulk">Bulk Listing</option>
              </select>
            </div>

            <div style={{ minWidth: '120px' }}>
              <label className="form-label">Per Page</label>
              <select
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                className="form-select"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <button
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  vendor_filter: '',
                  operation_filter: '',
                  page: 1
                }));
              }}
              className="btn btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="results-summary">
        <div className="results-info">
          Showing {history.length} of {pagination.total.toLocaleString()} operations
        </div>
        
        <div className="results-actions">
          <button
            onClick={loadListingHistory}
            className="btn btn-secondary"
            disabled={loading}
          >
            <Download size={16} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading listing history...</p>
        </div>
      )}

      {/* History Table */}
      {!loading && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {history.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Vendor</th>
                      <th>Type</th>
                      <th>Products</th>
                      <th>Success Rate</th>
                      <th>Results</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(operation => (
                      <ListingOperationRow 
                        key={operation.id} 
                        operation={operation}
                        onViewDetails={(op) => console.log('View details:', op)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ShoppingCart size={48} className="empty-state-icon" />
                <h3 className="empty-state-title">No listing operations found</h3>
                <p className="empty-state-text">
                  No listing operations match your current filters. Try adjusting the filters or start listing some products.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.total > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Page {filters.page} of {Math.ceil(pagination.total / filters.limit)}
          </div>
          
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={!pagination.has_prev}
              className="btn btn-secondary"
            >
              Previous
            </button>
            
            <span className="page-numbers">
              {Array.from({ length: Math.min(5, Math.ceil(pagination.total / filters.limit)) }, (_, i) => {
                const pageNum = Math.max(1, filters.page - 2) + i;
                if (pageNum <= Math.ceil(pagination.total / filters.limit)) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`btn ${pageNum === filters.page ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minWidth: '40px' }}
                    >
                      {pageNum}
                    </button>
                  );
                }
                return null;
              })}
            </span>
            
            <button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={!pagination.has_next}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ListingOperationRow = ({ operation, onViewDetails }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getOperationIcon = (type) => {
    return type === 'bulk' ? <Package size={16} /> : <ShoppingCart size={16} />;
  };

  const getStatusIcon = (successRate) => {
    const rate = parseFloat(successRate);
    if (rate === 100) return <CheckCircle size={16} className="success-icon" />;
    if (rate > 0) return <Clock size={16} className="warning-icon" />;
    return <XCircle size={16} className="error-icon" />;
  };

  const getSuccessRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (numRate >= 90) return 'var(--success)';
    if (numRate >= 70) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <>
      <tr>
        <td>
          <div style={{ fontSize: '14px' }}>
            {new Date(operation.timestamp).toLocaleDateString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
            {new Date(operation.timestamp).toLocaleTimeString()}
          </div>
        </td>
        
        <td>
          <div style={{ textTransform: 'capitalize', fontWeight: '500' }}>
            {operation.vendor}
          </div>
        </td>
        
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getOperationIcon(operation.operation_type)}
            <span style={{ textTransform: 'capitalize' }}>
              {operation.operation_type}
            </span>
          </div>
        </td>
        
        <td>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: '600' }}>
              {operation.total_requested}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
              requested
            </div>
          </div>
        </td>
        
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getStatusIcon(operation.success_rate)}
            <span style={{ 
              color: getSuccessRateColor(operation.success_rate),
              fontWeight: '600'
            }}>
              {operation.success_rate}
            </span>
          </div>
        </td>
        
        <td>
          <div style={{ fontSize: '14px' }}>
            <span style={{ color: 'var(--success)' }}>
              ✓ {operation.successful_listings}
            </span>
            {operation.failed_listings > 0 && (
              <span style={{ color: 'var(--error)', marginLeft: '8px' }}>
                ✗ {operation.failed_listings}
              </span>
            )}
          </div>
        </td>
        
        <td>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="btn btn-sm btn-secondary"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
        </td>
      </tr>
      
      {/* Details Row */}
      {showDetails && (
        <tr>
          <td colSpan="7" style={{ backgroundColor: 'var(--lighter-blue)', padding: '16px' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                Operation Details
              </h4>
              
              <div className="grid grid-2" style={{ gap: '16px' }}>
                {/* SKU List */}
                <div>
                  <h5 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--gray-700)' }}>
                    Products Processed ({operation.sku_data?.length || 0}):
                  </h5>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {operation.sku_data?.map((sku_item, index) => (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '4px 0',
                        borderBottom: '1px solid var(--light-blue)'
                      }}>
                        {sku_item.success ? 
                          <CheckCircle size={12} className="success-icon" /> : 
                          <XCircle size={12} className="error-icon" />
                        }
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {sku_item.sku}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--gray-600)', flexGrow: 1 }}>
                          {sku_item.title}
                        </span>
                        {sku_item.shopify_product_id && (
                          <span style={{ fontSize: '10px', color: 'var(--success)' }}>
                            Listed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Error Summary */}
                {operation.failed_listings > 0 && (
                  <div>
                    <h5 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--error)' }}>
                      Failed Products ({operation.failed_listings}):
                    </h5>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {operation.sku_data?.filter(item => !item.success).map((sku_item, index) => (
                        <div key={index} style={{ 
                          padding: '4px 8px',
                          backgroundColor: '#fef2f2',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          border: '1px solid #fecaca'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '600' }}>
                            {sku_item.sku}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--error)' }}>
                            {sku_item.error}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default ListingHistoryPage;