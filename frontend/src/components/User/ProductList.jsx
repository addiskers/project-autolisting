import React from 'react';
import ProductCard from './ProductCard';
import Loading from '../Shared/Loading';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

const ProductList = ({ 
  products, 
  loading, 
  pagination, 
  currentPage = 1, 
  onPageChange 
}) => {
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

  return (
    <div>
      {/* Results Summary */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
          Showing {startIndex}-{endIndex} of {pagination.total.toLocaleString()} products
        </div>
        
        {totalPages > 1 && (
          <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
            Page {currentPage} of {totalPages}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-3">
        {products.map(product => (
          <ProductCard key={product.id || product.sku} product={product} />
        ))}
      </div>

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