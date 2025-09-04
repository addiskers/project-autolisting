import React, { useState } from 'react';
import { ExternalLink, Package, Droplets, Award, Image as ImageIcon, ShoppingCart, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { shopifyAPI, handleAPIError } from '../../services/api';

const ProductRow = ({ 
  product, 
  isSelected = false, 
  onSelectionChange, 
  showCheckbox = false 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingStatus, setListingStatus] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check if product is already listed on Shopify
  const isListedOnShopify = product.listed_on_shopify || false;
  const shopifyProductId = product.shopify_product_id;
  const listedAt = product.listed_at;

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleListOnShopify = async (forceRelist = false) => {
    if (!product.sku) {
      alert('Product SKU is required for listing');
      return;
    }

    // If product is already listed and not forcing relist, show confirmation
    if (isListedOnShopify && !forceRelist) {
      setShowConfirmDialog(true);
      return;
    }

    setListingLoading(true);
    setShowConfirmDialog(false);
    
    try {
      let result;
      if (forceRelist) {
        result = await shopifyAPI.listProductWithForce(product.sku, true);
      } else {
        result = await shopifyAPI.listProduct(product.sku);
      }

      if (result.already_listed && !forceRelist) {
        setShowConfirmDialog(true);
        return;
      }
      
      setListingStatus('success');
      alert(`Product "${product.title}" has been successfully listed on Shopify!`);
      console.log('Listing result:', result);
      
      // Update local state to reflect listing
      if (onSelectionChange && typeof onSelectionChange === 'function') {
        window.location.reload();
      }
      
    } catch (error) {
      setListingStatus('error');
      const errorMessage = handleAPIError(error);
      
      if (error.response?.data?.already_listed) {
        setShowConfirmDialog(true);
        return;
      }
      
      alert(`Failed to list product: ${errorMessage}`);
      console.error('Listing error:', error);
    } finally {
      setListingLoading(false);
      setTimeout(() => setListingStatus(null), 3000);
    }
  };

  const handleConfirmRelist = () => {
    handleListOnShopify(true);
  };

  const handleCancelRelist = () => {
    setShowConfirmDialog(false);
  };

  const getStatusColor = (status) => {
    if (!status) return 'var(--gray-400)';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('stock') || statusLower.includes('available')) {
      return 'var(--success)';
    } else if (statusLower.includes('limited') || statusLower.includes('low')) {
      return 'var(--warning)';
    } else if (statusLower.includes('out') || statusLower.includes('unavailable')) {
      return 'var(--error)';
    }
    return 'var(--gray-400)';
  };

  const formatDescription = (description) => {
    if (!description) return '';
    
    if (Array.isArray(description)) {
      return description.join(' • ').substring(0, 200) + '...';
    }
    
    return typeof description === 'string' 
      ? description.substring(0, 200) + (description.length > 200 ? '...' : '')
      : '';
  };

  const formatFeatures = (features) => {
    if (!features) return [];
    
    if (Array.isArray(features)) {
      return features.slice(0, 4);
    }
    
    return [];
  };

  const formatListedDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <>
      <div className={`product-row ${isSelected ? 'selected' : ''}`} style={{ position: 'relative' }}>
        {/* Selection Checkbox */}
        {showCheckbox && (
          <div className="product-row-checkbox">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectionChange(product, e.target.checked)}
            />
          </div>
        )}

        {/* Listing Status Indicator */}
        {(listingStatus || isListedOnShopify) && (
          <div className={`status-indicator ${
            listingStatus === 'success' ? 'success' : 
            listingStatus === 'error' ? 'error' : 
            isListedOnShopify ? 'listed' : ''
          }`}>
            {listingStatus === 'success' ? 'Listed!' : 
             listingStatus === 'error' ? 'Failed' : 
             isListedOnShopify ? 'Listed' : ''}
          </div>
        )}

        {/* Product Image */}
        <div className="product-row-image">
          {product.images && product.images.length > 0 && !imageError ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {imageLoading && (
                <div className="image-loading">
                  <div className="spinner-small"></div>
                </div>
              )}
              <img
                src={product.images[0]}
                alt={product.title}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: imageLoading ? 'none' : 'block'
                }}
              />
            </div>
          ) : (
            <div className="no-image-placeholder">
              <ImageIcon size={24} />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-row-content">
          {/* Title & SKU */}
          <div className="product-row-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h3 className="product-row-title">
                {product.title || 'Untitled Product'}
              </h3>
              
              {/* Listed Badge */}
              {isListedOnShopify && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: '#d1fae5',
                  color: '#065f46',
                  border: '1px solid #10b981'
                }}>
                  <CheckCircle size={10} />
                  Listed
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              {product.sku && (
                <div className="product-row-sku">
                  SKU: {product.sku}
                </div>
              )}
              
              {/* Listed Information */}
              {isListedOnShopify && (
                <div style={{ 
                  fontSize: '12px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {listedAt && (
                    <span>Listed: {formatListedDate(listedAt)}</span>
                  )}
                  {shopifyProductId && (
                    <span>ID: {shopifyProductId.split('/').pop()}</span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="product-row-description">
                {formatDescription(product.description)}
              </p>
            )}
          </div>

          {/* Tags and Features */}
          <div className="product-row-details">
            {/* Product Tags */}
            <div className="product-row-tags">
              {product.category && (
                <span className="tag">{product.category}</span>
              )}
              
              {product.main_color && (
                <span className="tag">{product.main_color}</span>
              )}
              
              {product.wels_rating && (
                <span className="tag">
                  <Droplets size={12} style={{ marginRight: '4px' }} />
                  {product.wels_rating}
                </span>
              )}
              
              {product.flow_rate && (
                <span className="tag">
                  {product.flow_rate}
                </span>
              )}
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div className="product-row-features">
                <span className="features-label">Features:</span>
                <div className="features-list">
                  {formatFeatures(product.features).map((feature, index) => (
                    <span key={index} className="feature-item">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="product-row-status">
          {product.status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(product.status)
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                {product.status}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="product-row-actions">
          {/* List on Shopify Button */}
          <button
            onClick={() => handleListOnShopify(false)}
            disabled={listingLoading || !product.sku}
            className={`btn ${isListedOnShopify ? 'btn-secondary' : 'btn-primary'}`}
            style={{ 
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '8px',
              width: '100%',
              position: 'relative'
            }}
          >
            {listingLoading ? (
              <>
                <Loader size={12} className="spinner" />
                Listing...
              </>
            ) : isListedOnShopify ? (
              <>
                <AlertTriangle size={12} />
                Relist
              </>
            ) : (
              <>
                <ShoppingCart size={12} />
                List on Shopify
              </>
            )}
          </button>

          {/* View Link */}
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ 
                padding: '6px 16px', 
                fontSize: '12px',
                textDecoration: 'none',
                width: '100%'
              }}
            >
              <ExternalLink size={12} />
              View
            </a>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <AlertTriangle size={24} style={{ color: '#f59e0b', marginRight: '12px' }} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Product Already Listed
              </h3>
            </div>
            
            <p style={{ marginBottom: '16px', color: 'var(--gray-600)' }}>
              <strong>"{product.title}"</strong> is already listed on Shopify.
              {listedAt && ` It was listed on ${formatListedDate(listedAt)}.`}
            </p>
            
            <p style={{ marginBottom: '24px', color: 'var(--gray-600)' }}>
              Do you want to create a new listing anyway? This will create a duplicate product.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelRelist}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRelist}
                className="btn btn-primary"
                style={{ padding: '8px 16px' }}
              >
                Yes, Create New Listing
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .status-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          z-index: 2;
        }
        
        .status-indicator.success {
          background: var(--success);
          color: white;
        }
        
        .status-indicator.error {
          background: var(--error);
          color: white;
        }
        
        .status-indicator.listed {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>
    </>
  );
};

export default ProductRow;