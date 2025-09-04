import React, { useState } from 'react';
import { ExternalLink, Package, Droplets, Award, Image as ImageIcon, ShoppingCart, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { shopifyAPI, handleAPIError } from '../../services/api';

const ProductCard = ({ 
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
        // Force relist by sending header
        result = await shopifyAPI.listProductWithForce(product.sku, true);
      } else {
        result = await shopifyAPI.listProduct(product.sku);
      }

      if (result.already_listed && !forceRelist) {
        // Product is already listed, show confirmation dialog
        setShowConfirmDialog(true);
        return;
      }
      
      setListingStatus('success');
      alert(`Product "${product.title}" has been successfully listed on Shopify!`);
      console.log('Listing result:', result);
      
      // Update local state to reflect listing
      if (onSelectionChange && typeof onSelectionChange === 'function') {
        // Trigger a refresh of the parent component if possible
        // This is a basic way - in a real app you might use context or state management
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
      // Reset status after 3 seconds
      setTimeout(() => setListingStatus(null), 3000);
    }
  };

  const handleConfirmRelist = () => {
    handleListOnShopify(true); // Force relist
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
      return description.join(' • ').substring(0, 150) + '...';
    }
    
    return typeof description === 'string' 
      ? description.substring(0, 150) + (description.length > 150 ? '...' : '')
      : '';
  };

  const formatFeatures = (features) => {
    if (!features) return [];
    
    if (Array.isArray(features)) {
      return features.slice(0, 3); // Show max 3 features
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
      <div className="product-card" style={{ position: 'relative' }}>
        {/* Selection Checkbox */}
        {showCheckbox && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 2,
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            padding: '4px'
          }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectionChange(product, e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer'
              }}
            />
          </div>
        )}

        {/* Listed Status Badge */}
        {isListedOnShopify && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            background: '#d1fae5',
            color: '#065f46',
            border: '1px solid #10b981'
          }}>
            <CheckCircle size={12} />
            Listed
          </div>
        )}

        {/* Listing Status Indicator */}
        {listingStatus && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: isListedOnShopify ? '80px' : '12px',
            zIndex: 2,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            background: listingStatus === 'success' ? 'var(--success)' : 'var(--error)',
            color: 'white'
          }}>
            {listingStatus === 'success' ? 'Listed!' : 'Failed'}
          </div>
        )}

        {/* Product Image */}
        <div className="product-image">
          {product.images && product.images.length > 0 && !imageError ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {imageLoading && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }}>
                  <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
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
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: 'var(--gray-400)'
            }}>
              <ImageIcon size={32} style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '12px' }}>No Image</span>
            </div>
          )}
        </div>

        {/* Product Content */}
        <div className="product-content">
          {/* Title & SKU */}
          <div style={{ marginBottom: '12px' }}>
            <h3 className="product-title">
              {product.title || 'Untitled Product'}
            </h3>
            
            {product.sku && (
              <div className="product-sku">
                SKU: {product.sku}
              </div>
            )}
          </div>

          {/* Listed Information */}
          {isListedOnShopify && (
            <div style={{ 
              marginBottom: '12px', 
              padding: '8px', 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: '600', color: '#065f46', marginBottom: '2px' }}>
                Listed on Shopify
              </div>
              {listedAt && (
                <div style={{ color: '#166534' }}>
                  Listed on: {formatListedDate(listedAt)}
                </div>
              )}
              {shopifyProductId && (
                <div style={{ color: '#166534' }}>
                  ID: {shopifyProductId.split('/').pop()}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="product-description">
              {formatDescription(product.description)}
            </p>
          )}

          {/* Product Tags */}
          <div className="product-tags">
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
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: 'var(--gray-700)',
                marginBottom: '8px'
              }}>
                Features:
              </h4>
              <ul style={{ 
                fontSize: '12px', 
                color: 'var(--gray-600)',
                margin: 0,
                paddingLeft: '16px'
              }}>
                {formatFeatures(product.features).map((feature, index) => (
                  <li key={index} style={{ marginBottom: '2px' }}>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '8px',
            marginTop: 'auto'
          }}>
            {/* List on Shopify Button */}
            <button
              onClick={() => handleListOnShopify(false)}
              disabled={listingLoading || !product.sku}
              className={`btn ${isListedOnShopify ? 'btn-secondary' : 'btn-primary'} btn-full-width`}
              style={{ 
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
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
                  Relist on Shopify
                </>
              ) : (
                <>
                  <ShoppingCart size={12} />
                  List on Shopify
                </>
              )}
            </button>

            {/* Status & View Link Row */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
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
              
              {product.url && (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px',
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={12} />
                  View
                </a>
              )}
            </div>
          </div>
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
    </>
  );
};

export default ProductCard;