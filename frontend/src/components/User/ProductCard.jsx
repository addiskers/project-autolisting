import React, { useState } from 'react';
import { ExternalLink, Package, Droplets, Award, Image as ImageIcon } from 'lucide-react';

const ProductCard = ({ product }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
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

  return (
    <div className="product-card">
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

        {/* Status & Link */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: 'auto'
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
  );
};

export default ProductCard;