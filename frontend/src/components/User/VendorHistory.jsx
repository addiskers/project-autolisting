import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  CheckSquare,
  Square,
  ShoppingCart,
  Loader,
  Grid3X3,
  List
} from 'lucide-react';
import { vendorHistoryAPI, shopifyAPI, handleAPIError } from '../../services/api';
import Loading from '../Shared/Loading';
import ProductCard from './ProductCard';
import ProductRow from './ProductRow';
import CategoryFilter from './CategoryFilter';

const VendorHistory = () => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    NEW: 0,
    UPDATED: 0,
    UNCHANGED: 0,
    DELETED: 0,
    ALL: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkListingLoading, setBulkListingLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState('card');
  const [filters, setFilters] = useState({
    category: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });

  const vendors = [
    { value: 'phoenix', label: 'Phoenix' },
    { value: 'hansgrohe', label: 'Hansgrohe' },
    { value: 'moen', label: 'Moen' },
    { value: 'kohler', label: 'Kohler' }
  ];

  const tabs = [
    { key: 'ALL', label: 'All Products', icon: <Package size={16} />, color: 'var(--gray-600)' },
    { key: 'NEW', label: 'New', icon: <Plus size={16} />, color: '#10b981' },
    { key: 'UPDATED', label: 'Updated', icon: <RefreshCw size={16} />, color: '#f59e0b' },
    { key: 'UNCHANGED', label: 'Unchanged', icon: <Clock size={16} />, color: '#6b7280' },
    { key: 'DELETED', label: 'Deleted', icon: <Trash2 size={16} />, color: '#ef4444' }
  ];

  // Load layout preference
  useEffect(() => {
    const savedLayout = localStorage.getItem('productLayoutMode');
    if (savedLayout && (savedLayout === 'card' || savedLayout === 'row')) {
      setLayoutMode(savedLayout);
    }
  }, []);

  const handleLayoutChange = (newLayout) => {
    setLayoutMode(newLayout);
    localStorage.setItem('productLayoutMode', newLayout);
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadVendorHistory();
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [filters.search]);

  // Load data when other dependencies change
  useEffect(() => {
    if (selectedVendor) {
      loadVendorHistory();
    } else {
      resetState();
    }
  }, [selectedVendor, activeTab, pagination.page]);

  // Filter products based on category and search
  useEffect(() => {
    if (!products.length) {
      setFilteredProducts([]);
      return;
    }

    let filtered = [...products];

    if (filters.category) {
      filtered = filtered.filter(product => 
        product.category === filters.category
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(product =>
        product.title?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredProducts(filtered);
    setSelectedProducts(new Set()); 
  }, [products, filters]);

  const resetState = () => {
    setProducts([]);
    setFilteredProducts([]);
    setCategories([]);
    setStatusCounts({
      NEW: 0,
      UPDATED: 0,
      UNCHANGED: 0,
      DELETED: 0,
      ALL: 0
    });
    setSelectedProducts(new Set());
    setSelectMode(false);
    setError(null);
  };

  const loadVendorHistory = useCallback(async () => {
    if (!selectedVendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: pagination.page,
        limit: 50, // Load more for better local filtering
        status_filter: activeTab !== 'ALL' ? activeTab : undefined
      };

      const data = await vendorHistoryAPI.getVendorHistory(selectedVendor, params);
      
      const fetchedProducts = data.data.products || [];
      setProducts(fetchedProducts);
      setStatusCounts(data.data.status_counts || {});
      
      // Extract unique categories
      const uniqueCategories = [...new Set(
        fetchedProducts
          .map(product => product.category)
          .filter(category => category)
      )].sort();
      setCategories(uniqueCategories);
      
      setPagination(prev => ({
        ...prev,
        total: data.data.pagination.total,
        total_pages: data.data.pagination.total_pages,
        has_next: data.data.pagination.has_next,
        has_prev: data.data.pagination.has_prev
      }));
      
    } catch (error) {
      console.error('Error loading vendor history:', error);
      setError(`Failed to load vendor history: ${handleAPIError(error)}`);
      resetState();
    } finally {
      setLoading(false);
    }
  }, [selectedVendor, activeTab, pagination.page, pagination.limit]);

  const handleVendorChange = (event) => {
    const newVendor = event.target.value;
    setSelectedVendor(newVendor);
    setPagination(prev => ({ ...prev, page: 1 }));
    setActiveTab('ALL');
    setFilters({ category: '', search: '' });
    setError(null);
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setPagination(prev => ({ ...prev, page: 1 }));
    setSelectedProducts(new Set());
    setSelectMode(false);
    setError(null);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Selection handlers
  const handleSelectionChange = (product, isSelected) => {
    const newSelected = new Set(selectedProducts);
    const productKey = product.id || product.sku;
    
    if (isSelected) {
      newSelected.add(productKey);
    } else {
      newSelected.delete(productKey);
    }
    
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      const allProductKeys = new Set(filteredProducts.map(p => p.id || p.sku));
      setSelectedProducts(allProductKeys);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setSelectedProducts(new Set());
    }
  };

  // Bulk listing handler
  const handleBulkListOnShopify = async () => {
    const selectedProductsList = filteredProducts.filter(p => 
      selectedProducts.has(p.id || p.sku)
    );
    
    if (selectedProductsList.length === 0) {
      alert('Please select at least one product to list');
      return;
    }

    const skus = selectedProductsList
      .filter(p => p.sku)
      .map(p => p.sku);

    if (skus.length === 0) {
      alert('Selected products must have SKUs to be listed');
      return;
    }

    setBulkListingLoading(true);
    
    try {
      const result = await shopifyAPI.listMultipleProducts(skus);
      alert(`Successfully initiated listing for ${skus.length} products on Shopify!`);
      console.log('Bulk listing result:', result);
      
      setSelectedProducts(new Set());
      setSelectMode(false);
      
    } catch (error) {
      const errorMessage = handleAPIError(error);
      alert(`Failed to list products: ${errorMessage}`);
      console.error('Bulk listing error:', error);
    } finally {
      setBulkListingLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'NEW': { color: '#10b981', bg: '#d1fae5', text: '#065f46' },
      'UPDATED': { color: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
      'UNCHANGED': { color: '#6b7280', bg: '#f3f4f6', text: '#374151' },
      'DELETED': { color: '#ef4444', bg: '#fee2e2', text: '#991b1b' }
    };
    
    const config = statusConfig[status] || statusConfig['UNCHANGED'];
    
    return (
      <span style={{
        backgroundColor: config.bg,
        color: config.text,
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {tabs.find(t => t.key === status)?.icon}
        {status}
      </span>
    );
  };

  const currentVendorLabel = vendors.find(v => v.value === selectedVendor)?.label || selectedVendor;
  const selectedCount = selectedProducts.size;
  const isAllSelected = selectedCount === filteredProducts.length && filteredProducts.length > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Calendar size={24} />
          Vendor History
        </h1>
        <p className="page-subtitle">
          Track product changes and status across fetching sessions
        </p>
      </div>

      {/* Vendor Selector */}
      <div className="card vendor-selector-card">
        <div className="card-body">
          <h3 className="vendor-selector-title">
            Select Vendor
          </h3>
          <div className="vendor-selector-container">
            <select
              value={selectedVendor}
              onChange={handleVendorChange}
              className="form-select vendor-select"
            >
              <option value="">Choose a vendor...</option>
              {vendors.map(vendor => (
                <option key={vendor.value} value={vendor.value}>
                  {vendor.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Loading message={`Loading ${currentVendorLabel || 'vendor'} products...`} />
      )}

      {/* Error Alert */}
      {error && (
        <div style={{ 
          backgroundColor: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>
              Error loading data
            </div>
            <div style={{ fontSize: '14px', color: '#991b1b' }}>
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {selectedVendor && !loading && !error && (
        <>
          {/* Status Tabs */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-body" style={{ padding: '0' }}>
              <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid var(--gray-200)',
                overflowX: 'auto'
              }}>
                {tabs.map(tab => {
                  const count = tab.key === 'ALL' ? statusCounts.ALL : statusCounts[tab.key] || 0;
                  const isActive = activeTab === tab.key;
                  
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTabChange(tab.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '16px 20px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                        color: isActive ? tab.color : 'var(--gray-600)',
                        fontWeight: isActive ? '600' : '400',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                      <span style={{
                        backgroundColor: isActive ? `${tab.color}20` : 'var(--gray-100)',
                        color: isActive ? tab.color : 'var(--gray-600)',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filters */}
          {categories.length > 0 && (
            <CategoryFilter
              categories={categories}
              selectedCategory={filters.category}
              searchQuery={filters.search}
              onFilterChange={handleFilterChange}
              showAdvanced={true}
            />
          )}

          {/* Results and Actions */}
          {filteredProducts.length > 0 ? (
            <>
              {/* Results Summary and Bulk Actions */}
              <div className="results-summary">
                <div className="results-info">
                  Showing {filteredProducts.length.toLocaleString()} products
                  {selectMode && selectedCount > 0 && (
                    <span className="selected-count">
                      ({selectedCount} selected)
                    </span>
                  )}
                </div>
                
                <div className="results-actions">
                  {/* Layout Toggle */}
                  <div className="layout-toggle-container">
                    <button
                      onClick={() => handleLayoutChange('card')}
                      className={`layout-toggle-btn ${layoutMode === 'card' ? 'active' : ''}`}
                      title="Card View"
                    >
                      <Grid3X3 size={16} />
                    </button>
                    <button
                      onClick={() => handleLayoutChange('row')}
                      className={`layout-toggle-btn ${layoutMode === 'row' ? 'active' : ''}`}
                      title="Row View"
                    >
                      <List size={16} />
                    </button>
                  </div>

                  <button
                    onClick={toggleSelectMode}
                    className={`btn ${selectMode ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {selectMode ? (
                      <>
                        <CheckSquare size={16} />
                        Exit Select
                      </>
                    ) : (
                      <>
                        <Square size={16} />
                        Select Mode
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {selectMode && (
                <div className="bulk-actions-bar">
                  <div className="bulk-actions-left">
                    <button
                      onClick={handleSelectAll}
                      className="btn btn-secondary"
                    >
                      {isAllSelected ? (
                        <>
                          <Square size={16} />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <CheckSquare size={16} />
                          Select All
                        </>
                      )}
                    </button>
                    
                    <span className="bulk-selection-info">
                      {selectedCount} of {filteredProducts.length} products selected
                    </span>
                  </div>

                  <button
                    onClick={handleBulkListOnShopify}
                    disabled={selectedCount === 0 || bulkListingLoading}
                    className="btn btn-primary"
                  >
                    {bulkListingLoading ? (
                      <>
                        <Loader size={16} className="spinner" />
                        Listing {selectedCount} Products...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} />
                        List {selectedCount} on Shopify
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Products Display */}
              {layoutMode === 'card' ? (
                <div className="grid grid-4">
                  {filteredProducts.map(product => {
                    const productKey = product.id || product.sku;
                    return (
                      <ProductCard 
                        key={productKey} 
                        product={{
                          ...product,
                          statusBadge: getStatusBadge(product.status_flag),
                          lastUpdated: formatDate(product.last_updated),
                          firstSeen: formatDate(product.first_seen)
                        }}
                        showCheckbox={selectMode}
                        isSelected={selectedProducts.has(productKey)}
                        onSelectionChange={handleSelectionChange}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="products-row-container">
                  {filteredProducts.map(product => {
                    const productKey = product.id || product.sku;
                    return (
                      <ProductRow 
                        key={productKey} 
                        product={{
                          ...product,
                          statusBadge: getStatusBadge(product.status_flag),
                          lastUpdated: formatDate(product.last_updated),
                          firstSeen: formatDate(product.first_seen)
                        }}
                        showCheckbox={selectMode}
                        isSelected={selectedProducts.has(productKey)}
                        onSelectionChange={handleSelectionChange}
                      />
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div style={{ 
                  marginTop: '32px',
                  padding: '20px 24px', 
                  border: '1px solid var(--gray-200)',
                  borderRadius: '8px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                    Page {pagination.page} of {pagination.total_pages} • {pagination.total.toLocaleString()} total products
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.has_prev}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '14px',
                        opacity: !pagination.has_prev ? 0.5 : 1,
                        cursor: !pagination.has_prev ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    
                    <span style={{ 
                      padding: '8px 16px', 
                      fontSize: '14px',
                      color: 'var(--gray-600)',
                      backgroundColor: 'var(--gray-50)',
                      borderRadius: '6px',
                      border: '1px solid var(--gray-200)'
                    }}>
                      {pagination.page}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.has_next}
                      className="btn btn-secondary"
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '14px',
                        opacity: !pagination.has_next ? 0.5 : 1,
                        cursor: !pagination.has_next ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="card-body empty-state">
                <Package size={48} className="empty-state-icon" />
                <h3 className="empty-state-title">
                  No products found
                </h3>
                <p className="empty-state-text">
                  {filters.search || filters.category ? 
                    'Try adjusting your search criteria or filters' : 
                    `No ${activeTab.toLowerCase()} products available for ${currentVendorLabel}`
                  }
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!selectedVendor && !loading && (
        <div className="card">
          <div className="card-body empty-state">
            <Calendar size={48} className="empty-state-icon" />
            <h3 className="empty-state-title">
              Select a vendor to begin
            </h3>
            <p className="empty-state-text">
              Choose a vendor from the dropdown above to track product changes and status history
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorHistory;