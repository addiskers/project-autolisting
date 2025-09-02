import React, { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import ProductRow from './ProductRow';
import Loading from '../Shared/Loading';
import { 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  CheckSquare, 
  Square, 
  ShoppingCart, 
  Loader,
  Grid3X3,
  List
} from 'lucide-react';
import { shopifyAPI, handleAPIError } from '../../services/api';

const ProductList = ({ 
  products, 
  loading, 
  pagination, 
  currentPage = 1, 
  onPageChange 
}) => {
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkListingLoading, setBulkListingLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState('card');

  useEffect(() => {
    setSelectedProducts(new Set());
  }, [products]);

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
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      const allProductKeys = new Set(products.map(p => p.id || p.sku));
      setSelectedProducts(allProductKeys);
    }
  };

  const handleBulkListOnShopify = async () => {
    const selectedProductsList = products.filter(p => 
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

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setSelectedProducts(new Set());
    }
  };

  if (loading) {
    return <Loading message="Loading products..." />;
  }

  if (!products || products.length === 0) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
          <Package size={48} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
            No products found
          </h3>
          <p style={{ color: 'var(--gray-500)' }}>
            Try adjusting your search criteria or scrape new data
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / 12);
  const startIndex = (currentPage - 1) * 12 + 1;
  const endIndex = Math.min(currentPage * 12, pagination.total);
  const selectedCount = selectedProducts.size;
  const isAllSelected = selectedCount === products.length && products.length > 0;

  return (
    <div>
      {/* Results Summary and Controls */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
          Showing {startIndex}-{endIndex} of {pagination.total.toLocaleString()} products
          {selectMode && selectedCount > 0 && (
            <span style={{ marginLeft: '8px', color: 'var(--primary-blue)', fontWeight: '600' }}>
              ({selectedCount} selected)
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {totalPages > 1 && (
            <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              Page {currentPage} of {totalPages}
            </div>
          )}
          
          {/* Layout Toggle */}
          <div style={{ 
            display: 'flex', 
            border: '1px solid var(--gray-300)', 
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
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
          
          {/* Select Mode Toggle */}
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
              {selectedCount} of {products.length} products selected
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

      {/* Products Display */}
      {layoutMode === 'card' ? (
        <div className="grid grid-4">
          {products.map(product => {
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
          {products.map(product => {
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          marginTop: '32px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '12px' 
        }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!pagination.hasPrev}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            margin: '0 16px'
          }}>
            {/* Page Numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    padding: '8px 12px', 
                    minWidth: '40px',
                    fontSize: '14px'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!pagination.hasNext}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductList;