import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

const CategoryFilter = ({ 
  categories = [], 
  selectedCategory, 
  searchQuery, 
  onFilterChange, 
  loading = false,
  showAdvanced = false 
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFilterChange({ search: localSearch });
  };

  const handleCategoryChange = (category) => {
    onFilterChange({ category });
  };

  const clearFilters = () => {
    setLocalSearch('');
    onFilterChange({ category: '', search: '' });
  };

  const hasActiveFilters = selectedCategory || searchQuery;

  return (
    <div className="filters-container">
      <div className="filters-row">
        {/* Search Input */}
        <div className="filter-group">
          <label className="form-label">Search Products</label>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="form-input"
                placeholder="Search by name, SKU, or description..."
                style={{ paddingLeft: '40px' }}
              />
              <Search 
                size={16} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--gray-400)'
                }}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Category Filter */}
        <div className="filter-group">
          <label className="form-label">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="form-select"
            disabled={loading}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="filter-group" style={{ display: 'flex', alignItems: 'end' }}>
            <button 
              onClick={clearFilters}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <X size={16} />
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div style={{ 
          marginTop: '16px', 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
            Active filters:
          </span>
          
          {searchQuery && (
            <span className="tag" style={{ backgroundColor: 'var(--light-blue)' }}>
              Search: "{searchQuery}"
            </span>
          )}
          
          {selectedCategory && (
            <span className="tag" style={{ backgroundColor: 'var(--light-blue)' }}>
              Category: {selectedCategory}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;