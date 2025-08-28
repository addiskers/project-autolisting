// frontend/src/components/Shared/GapAnalysis.jsx
import React, { useState, useEffect } from 'react';
import ProductCard from '../User/ProductCard';
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
  Database
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
  const [filters, setFilters] = useState({
    category: '',
    search: ''
  });

  // Available vendors - you can make this dynamic by fetching from API
  const vendors = [
    { value: 'phoenix', label: 'Phoenix Tapware' },
    { value: 'hansgrohe', label: 'Hansgrohe' },
    { value: 'moen', label: 'Moen' },
    { value: 'kohler', label: 'Kohler' }
  ];

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
      
      // Extract unique categories
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

  // Filter products based on search and category
  useEffect(() => {
    if (!deltaData?.data?.products_not_in_shopify) return;
    
    let products = [...deltaData.data.products_not_in_shopify];
    
    // Category filter
    if (filters.category) {
      products = products.filter(product => 
        product.category === filters.category
      );
    }
    
    // Search filter
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
      
      // Reset selection after successful listing
      setSelectedProducts(new Set());
      setSelectMode(false);
      
      // Optionally reload data to get updated gap
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <GitBranch size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Gap Analysis
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Find products that exist in scraped data but are missing from Shopify
        </p>
      </div>

      {/* Vendor Selector */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Select Vendor
          </h3>
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <select
              value={selectedVendor}
              onChange={handleVendorChange}
              className="form-select"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid var(--primary-blue)',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}
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
          <div className="grid grid-4" style={{ marginBottom: '24px' }}>
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <Database size={32} style={{ color: 'var(--primary-blue)', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {deltaData.data?.total_scraped?.toLocaleString() || 0}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  Scraped Products
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <ShoppingCart size={32} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {deltaData.data?.total_in_shopify?.toLocaleString() || 0}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  In Shopify
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <TrendingDown size={32} style={{ color: 'var(--warning)', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {deltaData.data?.delta_count?.toLocaleString() || 0}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  Missing Products
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <AlertCircle size={32} style={{ color: 'var(--error)', marginBottom: '8px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {filteredProducts?.length?.toLocaleString() || 0}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
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
              <div style={{ 
                marginBottom: '20px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  Showing {filteredProducts.length} missing products
                  {selectMode && selectedCount > 0 && (
                    <span style={{ marginLeft: '8px', color: 'var(--primary-blue)', fontWeight: '600' }}>
                      ({selectedCount} selected)
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={toggleSelectMode}
                    className={`btn ${selectMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
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
                <div style={{
                  background: 'var(--light-blue)',
                  border: '1px solid var(--primary-blue)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                      onClick={handleSelectAll}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '14px' }}
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
                    
                    <span style={{ fontSize: '14px', color: 'var(--dark-blue)' }}>
                      {selectedCount} of {filteredProducts.length} products selected
                    </span>
                  </div>

                  <button
                    onClick={handleBulkListOnShopify}
                    disabled={selectedCount === 0 || bulkListingLoading}
                    className="btn btn-primary"
                    style={{ padding: '10px 16px', fontSize: '14px' }}
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

              {/* Products Grid */}
              <div className="grid grid-3">
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
            </>
          ) : (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
                <CheckSquare size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
                <h3 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
                  No gap found!
                </h3>
                <p style={{ color: 'var(--gray-500)' }}>
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
          <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
            <GitBranch size={48} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
              Select a vendor to begin
            </h3>
            <p style={{ color: 'var(--gray-500)' }}>
              Choose a vendor from the dropdown above to analyze the gap between scraped and Shopify products
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GapAnalysis;