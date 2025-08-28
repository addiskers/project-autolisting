import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Shared/Header';
import Sidebar from '../components/Shared/Sidebar';
import ProductList from '../components/User/ProductList'; // Updated component
import CategoryFilter from '../components/User/CategoryFilter';
import ScrapeButton from '../components/User/ScrapeButton';
import GapAnalysis from '../components/Shared/GapAnalysis';
import { productsAPI, scrapingAPI, shopifyAPI, handleAPIError } from '../services/api';
import { Package, Search as SearchIcon, Download, ShoppingCart, GitBranch, Database } from 'lucide-react';
import ProductRow from '../components/User/ProductRow'; // Add this line

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

            {/* Shopify Management Page */}
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

            {/* Gap Analysis Page */}
            <Route
              path="/gap"
              element={<GapAnalysis />}
            />
            
            <Route
              path="/scrape"
              element={<ScrapePage onScrapeComplete={handleScrapeComplete} />}
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
          • API Endpoint: Products are listed via /api/list/sku endpoint
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

// ENHANCED SCRAPE PAGE with vendor selection
const ScrapePage = ({ onScrapeComplete }) => {
  const [selectedVendor, setSelectedVendor] = useState('');
  
  // Available vendors - same as GapAnalysis
  const vendors = [
    { value: 'phoenix', label: 'Phoenix' },
    { value: 'hansgrohe', label: 'Hansgrohe' },
    { value: 'moen', label: 'Moen' },
    { value: 'kohler', label: 'Kohler' }
  ];

  const handleVendorChange = (event) => {
    setSelectedVendor(event.target.value);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <Download size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {selectedVendor ? `Fetch Data from ${vendors.find(v => v.value === selectedVendor)?.label || selectedVendor}` : 'Fetch Data'}
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          {selectedVendor 
            ? `Fetch new product data from ${vendors.find(v => v.value === selectedVendor)?.label || selectedVendor} website and Shopify`
            : 'Select a vendor and fetch product data from websites and Shopify'
          }
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

      {/* Data Fetching Cards */}
      {selectedVendor && (
        <div className="grid grid-2">
          {/* Website Scraping Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Download size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Website Scraping
              </h3>
              <p className="card-subtitle">
                Fetch product data from {vendors.find(v => v.value === selectedVendor)?.label} website
              </p>
            </div>
            
            <div className="card-body">
              <ScrapeButton 
                vendor={selectedVendor}
                type="scrape"
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
                  What happens when you fetch from website:
                </h4>
                <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
                  <li>Scrapes latest product data from the vendor website</li>
                  <li>Updates existing products with new information</li>
                  <li>Adds newly discovered products</li>
                  <li>Process typically takes 2-5 minutes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Shopify Fetching Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Database size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Shopify Data Sync
              </h3>
              <p className="card-subtitle">
                Fetch product data from our Shopify store for {vendors.find(v => v.value === selectedVendor)?.label}
              </p>
            </div>
            
            <div className="card-body">
              <ScrapeButton 
                vendor={selectedVendor}
                type="shopify"
                onComplete={onScrapeComplete}
                fullWidth={true}
                showDetails={true}
              />
              
              <div style={{ 
                marginTop: '24px', 
                padding: '16px', 
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                  What happens when you fetch from Shopify:
                </h4>
                <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
                  <li>Connects to your Shopify store via GraphQL API</li>
                  <li>Fetches all products for the selected vendor</li>
                  <li>Stores data in separate collection for analysis</li>
                  <li>Process typically takes 1-2 minutes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedVendor && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
            <Download size={48} style={{ color: 'var(--gray-300)', marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
              Select a vendor to begin
            </h3>
            <p style={{ color: 'var(--gray-500)' }}>
              Choose a vendor from the dropdown above to start fetching data from both the website and Shopify
            </p>
          </div>
        </div>
      )}

      {/* Information Card */}
      {selectedVendor && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--lighter-blue) 0%, var(--light-blue) 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--primary-blue)'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: 'var(--dark-blue)' }}>
              Data Fetching Strategy
            </h4>
            <div style={{ fontSize: '14px', color: 'var(--gray-700)' }}>
              <p style={{ marginBottom: '8px' }}>
                <strong>Website Scraping:</strong> Use this to get the latest product information directly from the vendor's website. 
                This is your primary data source and should be run first.
              </p>
              <p style={{ marginBottom: '0' }}>
                <strong>Shopify Sync:</strong> Use this to fetch existing products from your Shopify store. 
                This helps with gap analysis and understanding what you already have listed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;