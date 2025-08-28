import React, { useState } from 'react';
import { ExternalLink, Package, Droplets, Award, Image as ImageIcon, ShoppingCart, Loader } from 'lucide-react';
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

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleListOnShopify = async () => {
    if (!product.sku) {
      alert('Product SKU is required for listing');
      return;
    }

    setListingLoading(true);
    try {
      const result = await shopifyAPI.listProduct(product.sku);
      setListingStatus('success');
      alert(`Product "${product.title}" has been successfully listed on Shopify!`);
      console.log('Listing result:', result);
    } catch (error) {
      setListingStatus('error');
      const errorMessage = handleAPIError(error);
      alert(`Failed to list product: ${errorMessage}`);
      console.error('Listing error:', error);
    } finally {
      setListingLoading(false);
      // Reset status after 3 seconds
      setTimeout(() => setListingStatus(null), 3000);
    }
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
      return features.slice(0, 4); // Show max 4 features in row
    }
    
    return [];
  };

  return (
    <div className={`product-row ${isSelected ? 'selected' : ''}`}>
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
      {listingStatus && (
        <div className={`status-indicator ${listingStatus}`}>
          {listingStatus === 'success' ? 'Listed!' : 'Failed'}
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
          <h3 className="product-row-title">
            {product.title || 'Untitled Product'}
          </h3>
          
          {product.sku && (
            <div className="product-row-sku">
              SKU: {product.sku}
            </div>
          )}

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
          onClick={handleListOnShopify}
          disabled={listingLoading || !product.sku}
          className="btn btn-primary"
          style={{ 
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px',
            width: '100%'
          }}
        >
          {listingLoading ? (
            <>
              <Loader size={12} className="spinner" />
              Listing...
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
  );
};

export default ProductRow;