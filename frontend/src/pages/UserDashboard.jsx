// Example of how to use the updated components in your UserDashboard

import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Shared/Header';
import Sidebar from '../components/Shared/Sidebar';
import ProductList from '../components/User/ProductList'; // Updated component
import CategoryFilter from '../components/User/CategoryFilter';
import ScrapeButton from '../components/User/ScrapeButton';
import { productsAPI, scrapingAPI, shopifyAPI, handleAPIError } from '../services/api';
import { Package, Search as SearchIcon, Download, ShoppingCart } from 'lucide-react';

const UserDashboard = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    page: 1,
    limit: 12
  });
  const [pagination, setPagination] = useState({
    total: 0,
    hasNext: false,
    hasPrev: false
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load products when filters change
  useEffect(() => {
    loadProducts();
  }, [filters]);

  const loadInitialData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        productsAPI.getProducts({ limit: 12 }),
        productsAPI.getCategories()
      ]);

      setProducts(productsData.products || []);
      setCategories(categoriesData || []);
      setPagination({
        total: productsData.total || 0,
        hasNext: productsData.has_next || false,
        hasPrev: productsData.has_prev || false
      });
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (searchLoading) return;
    
    setSearchLoading(true);
    try {
      const params = {
        page: filters.page,
        limit: filters.limit
      };

      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;

      const data = await productsAPI.getProducts(params);
      
      setProducts(data.products || []);
      setPagination({
        total: data.total || 0,
        hasNext: data.has_next || false,
        hasPrev: data.has_prev || false
      });
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const handleScrapeComplete = async () => {
    await loadInitialData();
  };

  return (
    <div className="main-content">
      <Header />
      <div className="dashboard-layout">
        <Sidebar />
        <main className="content-area">
          <Routes>
            <Route
              path="/"
              element={
                <ProductsPage
                  products={products}
                  categories={categories}
                  filters={filters}
                  pagination={pagination}
                  loading={loading}
                  searchLoading={searchLoading}
                  onFilterChange={handleFilterChange}
                  onPageChange={handlePageChange}
                  onScrapeComplete={handleScrapeComplete}
                />
              }
            />
            
            <Route
              path="/search"
              element={
                <SearchPage
                  products={products}
                  categories={categories}
                  filters={filters}
                  pagination={pagination}
                  searchLoading={searchLoading}
                  onFilterChange={handleFilterChange}
                  onPageChange={handlePageChange}
                />
              }
            />
            
            <Route
              path="/scrape"
              element={<ScrapePage onScrapeComplete={handleScrapeComplete} />}
            />

            {/* New Shopify Management Page */}
            <Route
              path="/shopify"
              element={
                <ShopifyPage
                  products={products}
                  categories={categories}
                  filters={filters}
                  pagination={pagination}
                  loading={loading}
                  searchLoading={searchLoading}
                  onFilterChange={handleFilterChange}
                  onPageChange={handlePageChange}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Enhanced Products Page with Shopify Integration
const ProductsPage = ({ 
  products, 
  categories, 
  filters, 
  pagination, 
  loading, 
  searchLoading,
  onFilterChange, 
  onPageChange,
  onScrapeComplete 
}) => {
  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
            Products
          </h1>
          <p style={{ color: 'var(--gray-600)' }}>
            Browse, search, and list products on Shopify
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ScrapeButton onComplete={onScrapeComplete} />
        </div>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={filters.category}
        searchQuery={filters.search}
        onFilterChange={onFilterChange}
        loading={searchLoading}
      />

      {/* This now includes all the new functionality */}
      <ProductList
        products={products}
        loading={loading || searchLoading}
        pagination={pagination}
        currentPage={filters.page}
        onPageChange={onPageChange}
      />
    </div>
  );
};

// Dedicated Shopify Management Page
const ShopifyPage = ({ 
  products, 
  categories, 
  filters, 
  pagination, 
  loading,
  searchLoading,
  onFilterChange, 
  onPageChange 
}) => {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <ShoppingCart size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Shopify Management
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Manage product listings on Shopify with bulk operations
        </p>
      </div>

      <div style={{ 
        background: 'var(--light-blue)',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid var(--primary-blue)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--dark-blue)' }}>
          Quick Actions
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--gray-700)', marginBottom: '12px' }}>
          Use "Select Mode" below to choose multiple products for bulk operations, or use individual "List on Shopify" buttons on each product.
        </p>
        <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
          • Individual listing: Click "List on Shopify" on any product card<br/>
          • Bulk listing: Enable "Select Mode", choose products, then click "List X on Shopify"<br/>
          • API Endpoint: Products are listed via /api/list/{`{sku}`} endpoint
        </div>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={filters.category}
        searchQuery={filters.search}
        onFilterChange={onFilterChange}
        loading={searchLoading}
        showAdvanced={true}
      />

      <ProductList
        products={products}
        loading={loading || searchLoading}
        pagination={pagination}
        currentPage={filters.page}
        onPageChange={onPageChange}
      />
    </div>
  );
};

// Other page components remain the same...
const SearchPage = ({ 
  products, 
  categories, 
  filters, 
  pagination, 
  searchLoading,
  onFilterChange, 
  onPageChange 
}) => {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <SearchIcon size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Advanced Search
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Search products with detailed filters and list them on Shopify
        </p>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={filters.category}
        searchQuery={filters.search}
        onFilterChange={onFilterChange}
        loading={searchLoading}
        showAdvanced={true}
      />

      <ProductList
        products={products}
        loading={searchLoading}
        pagination={pagination}
        currentPage={filters.page}
        onPageChange={onPageChange}
      />
    </div>
  );
};

const ScrapePage = ({ onScrapeComplete }) => {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <Download size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Fetch Data
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Fetch new product data from websites
        </p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">Data Scraping</h3>
          <p className="card-subtitle">
            Fetch the latest product information from configured websites
          </p>
        </div>
        
        <div className="card-body">
          <ScrapeButton 
            onComplete={onScrapeComplete}
            fullWidth={true}
            showDetails={true}
          />
          
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: 'var(--lighter-blue)',
            borderRadius: '8px',
            border: '1px solid var(--light-blue)'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              What happens when you fetch:
            </h4>
            <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
              <li>Fetches latest product data from websites</li>
              <li>Updates existing products with new information</li>
              <li>Adds newly discovered products</li>
              <li>Process typically takes 2-5 minutes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;