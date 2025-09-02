// frontend/src/components/Shared/GapAnalysis.jsx
import React, { useState, useEffect } from 'react';
import ProductCard from '../User/ProductCard';
import ProductRow from '../User/ProductRow';
import Loading from '../Shared/Loading';
import CategoryFilter from '../User/CategoryFilter';
import { 
  GitBranch,
  Package, 
  CheckSquare, 
  Square, 
  ShoppingCart, 
  Loader,
  AlertCircle,
  TrendingDown,
  Database,
  Grid3X3,
  List
} from 'lucide-react';
import { deltaAPI, shopifyAPI, handleAPIError } from '../../services/api';

const GapAnalysis = () => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [deltaData, setDeltaData] = useState(null);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkListingLoading, setBulkListingLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState('card'); // 'card' or 'row'
  const [filters, setFilters] = useState({
    category: '',
    search: ''
  });

  const vendors = [
    { value: 'phoenix', label: 'Phoenix' },
    { value: 'hansgrohe', label: 'Hansgrohe' },
    { value: 'moen', label: 'Moen' },
    { value: 'kohler', label: 'Kohler' }
  ];

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

  const loadDeltaData = async (vendor) => {
    if (!vendor) return;
    
    setLoading(true);
    setDeltaData(null);
    setFilteredProducts([]);
    setCategories([]);
    setSelectedProducts(new Set());
    setSelectMode(false);
    
    try {
      const response = await deltaAPI.getDelta(vendor);
      setDeltaData(response);
      
      const products = response.data?.products_not_in_shopify || [];
      setFilteredProducts(products);
      const uniqueCategories = [...new Set(
        products
          .map(product => product.category)
          .filter(category => category)
      )].sort();
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('Error loading delta data:', error);
      const errorMessage = handleAPIError(error);
      alert(`Failed to load gap analysis: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!deltaData?.data?.products_not_in_shopify) return;
    
    let products = [...deltaData.data.products_not_in_shopify];
    
    if (filters.category) {
      products = products.filter(product => 
        product.category === filters.category
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      products = products.filter(product =>
        product.title?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.manufacturer?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredProducts(products);
  }, [filters, deltaData]);

  const handleVendorChange = (event) => {
    const vendor = event.target.value;
    setSelectedVendor(vendor);
    if (vendor) {
      loadDeltaData(vendor);
    } else {
      setDeltaData(null);
      setFilteredProducts([]);
      setCategories([]);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

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
      
      loadDeltaData(selectedVendor);
    } catch (error) {
      const errorMessage = handleAPIError(error);
      alert(`Failed to list products: ${errorMessage}`);
      console.error('Bulk listing error:', error);
    } finally {
      setBulkListingLoading(false);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setSelectedProducts(new Set());
    }
  };

  const selectedCount = selectedProducts.size;
  const isAllSelected = selectedCount === filteredProducts.length && filteredProducts.length > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <GitBranch size={24} />
          Gap Analysis
        </h1>
        <p className="page-subtitle">
          Find products that exist in scraped data but are missing from Shopify
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
        <Loading message="Loading gap analysis..." />
      )}

      {/* Results */}
      {deltaData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-4 summary-cards">
            <div className="card">
              <div className="card-body summary-card-body">
                <Database size={32} className="summary-icon primary-icon" />
                <h3 className="summary-number">
                  {deltaData.data?.total_scraped?.toLocaleString() || 0}
                </h3>
                <p className="summary-label">
                  Scraped Products
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body summary-card-body">
                <ShoppingCart size={32} className="summary-icon success-icon" />
                <h3 className="summary-number">
                  {deltaData.data?.total_in_shopify?.toLocaleString() || 0}
                </h3>
                <p className="summary-label">
                  In Shopify
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body summary-card-body">
                <TrendingDown size={32} className="summary-icon warning-icon" />
                <h3 className="summary-number">
                  {deltaData.data?.delta_count?.toLocaleString() || 0}
                </h3>
                <p className="summary-label">
                  Missing Products
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body summary-card-body">
                <AlertCircle size={32} className="summary-icon error-icon" />
                <h3 className="summary-number">
                  {filteredProducts?.length?.toLocaleString() || 0}
                </h3>
                <p className="summary-label">
                  Filtered Results
                </p>
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
                  Showing {filteredProducts.length} missing products
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
                        product={product}
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
                        product={product}
                        showCheckbox={selectMode}
                        isSelected={selectedProducts.has(productKey)}
                        onSelectionChange={handleSelectionChange}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="card-body empty-state">
                <CheckSquare size={48} className="empty-state-icon success-icon" />
                <h3 className="empty-state-title">
                  No gap found!
                </h3>
                <p className="empty-state-text">
                  All scraped products for {selectedVendor} are already in Shopify, or no products match your filters.
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
            <GitBranch size={48} className="empty-state-icon" />
            <h3 className="empty-state-title">
              Select a vendor to begin
            </h3>
            <p className="empty-state-text">
              Choose a vendor from the dropdown above to analyze the gap between scraped and Shopify products
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GapAnalysis;