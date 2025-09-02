import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Shared/Header';
import Sidebar from '../components/Shared/Sidebar';
import WebsiteList from '../components/Admin/WebsiteList';
import AddWebsite from '../components/Admin/AddWebsite';
import Dashboard from '../components/Admin/Dashboard';
import ScrapeButton from '../components/User/ScrapeButton';
import HistoryPage from '../components/Admin/HistoryPage';
import ListingHistoryPage from '../components/Admin/ListingHistoryPage';
import { websitesAPI, healthAPI, vendorsAPI } from '../services/api';
import { Globe, Download, BarChart3, Database, Activity, ShoppingCart } from 'lucide-react';

const AdminDashboard = () => {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWebsites: 0,
    completedWebsites: 0,
    pendingWebsites: 0,
    totalProducts: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [websitesData, healthData] = await Promise.all([
        websitesAPI.getWebsites(),
        healthAPI.getHealth().catch(() => ({ products: 0 }))
      ]);

      setWebsites(websitesData);
      
      const completed = websitesData.filter(w => w.status === 'completed').length;
      const pending = websitesData.filter(w => w.status === 'pending').length;
      const totalProducts = websitesData.reduce((sum, w) => sum + (w.productsCount || 0), 0);

      setStats({
        totalWebsites: websitesData.length,
        completedWebsites: completed,
        pendingWebsites: pending,
        totalProducts: totalProducts || healthData.products || 0
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWebsiteAdded = (newWebsite) => {
    setWebsites(prev => [...prev, newWebsite]);
    setStats(prev => ({
      ...prev,
      totalWebsites: prev.totalWebsites + 1,
      pendingWebsites: prev.pendingWebsites + 1
    }));
  };

  const handleScrapeComplete = () => {
    loadData(); 
  };

  return (
    <div className="main-content">
      <Header />
      <div className="dashboard-layout">
        <Sidebar />
        <main className="content-area">
          <Routes>
            {/* Default Admin Dashboard */}
            <Route
              path="/"
              element={
                <Dashboard 
                  websites={websites} 
                  stats={stats} 
                  loading={loading}
                  onRefresh={loadData}
                />
              }
            />
            
            {/* Websites List */}
            <Route
              path="/websites"
              element={
                <WebsiteList 
                  websites={websites} 
                  loading={loading}
                  onRefresh={loadData}
                />
              }
            />
            
            {/* Fetch Operations History */}
            <Route
              path="/history"
              element={<HistoryPage />}
            />
            
            {/* Listing Operations History */}
            <Route
              path="/listing-history"
              element={<ListingHistoryPage />}
            />
            
            {/* Add Website */}
            <Route
              path="/add-website"
              element={
                <AddWebsite 
                  onWebsiteAdded={handleWebsiteAdded}
                />
              }
            />

            {/* Admin Scrape Management */}
            <Route
              path="/scrape"
              element={<AdminScrapePage onScrapeComplete={handleScrapeComplete} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const AdminScrapePage = ({ onScrapeComplete }) => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorStatuses, setVendorStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    if (vendors.length > 0) {
      loadVendorStatuses();
    }
  }, [vendors]);

  const loadVendors = async () => {
    try {
      const vendorsData = await vendorsAPI.getVendors();
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorStatuses = async () => {
    try {
      const statuses = {};
      
      for (const vendor of vendors) {
        const status = await vendorsAPI.getVendorStatus(vendor.value);
        statuses[vendor.value] = status;
      }
      
      setVendorStatuses(statuses);
    } catch (error) {
      console.error('Error loading vendor statuses:', error);
    }
  };

  const handleVendorChange = (event) => {
    setSelectedVendor(event.target.value);
  };

  const handleScrapeComplete = () => {
    loadVendorStatuses();
    if (onScrapeComplete) {
      onScrapeComplete();
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading vendors...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          <Download size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Data Management
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Manage data scraping and Shopify sync for all vendors
        </p>
      </div>

      {/* Quick Access Links */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <a 
          href="/admin/history" 
          className="btn btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          <Download size={16} />
          View Fetch History
        </a>
        <a 
          href="/admin/listing-history" 
          className="btn btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          <ShoppingCart size={16} />
          View Listing History
        </a>
      </div>

      {/* Vendor Overview Cards */}
      <div className="grid grid-2" style={{ marginBottom: '32px' }}>
        {vendors.map(vendor => {
          const status = vendorStatuses[vendor.value];
          const isActive = status?.isScrapingActive;
          const lastScrape = status?.lastScrape ? new Date(status.lastScrape) : null;
          const lastShopifyFetch = status?.lastShopifyFetch ? new Date(status.lastShopifyFetch) : null;
          
          return (
            <div key={vendor.value} className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Globe size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  {vendor.label}
                </h3>
                <p className="card-subtitle">{vendor.website}</p>
                {isActive && (
                  <div className="status status-info" style={{ marginTop: '8px' }}>
                    <Activity size={12} />
                    Scraping Active
                  </div>
                )}
              </div>
              
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                    Last Scrape: {lastScrape ? lastScrape.toLocaleDateString() + ' at ' + lastScrape.toLocaleTimeString() : 'Never'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                    Last Shopify Fetch: {lastShopifyFetch ? lastShopifyFetch.toLocaleDateString() + ' at ' + lastShopifyFetch.toLocaleTimeString() : 'Never'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ScrapeButton 
                    vendor={vendor.value}
                    type="scrape"
                    onComplete={handleScrapeComplete}
                    fullWidth={false}
                    showDetails={false}
                    disabled={isActive}
                  />
                  <ScrapeButton 
                    vendor={vendor.value}
                    type="shopify"
                    onComplete={handleScrapeComplete}
                    fullWidth={false}
                    showDetails={false}
                    disabled={isActive}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Management Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Detailed Management</h3>
          <p className="card-subtitle">
            Select a vendor for detailed data fetching operations
          </p>
        </div>
        <div className="card-body">
          {/* Vendor Selector */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Select Vendor for Detailed Operations</label>
            <select
              value={selectedVendor}
              onChange={handleVendorChange}
              className="form-select"
              style={{ maxWidth: '300px' }}
            >
              <option value="">Choose a vendor...</option>
              {vendors.map(vendor => (
                <option key={vendor.value} value={vendor.value}>
                  {vendor.label}
                </option>
              ))}
            </select>
          </div>

          {/* Detailed Controls for Selected Vendor */}
          {selectedVendor && (
            <div className="grid grid-2">
              {/* Website Scraping Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Website Scraping
                  </h3>
                  <p className="card-subtitle">
                    Fetch data from {vendors.find(v => v.value === selectedVendor)?.label} website
                  </p>
                </div>
                
                <div className="card-body">
                  <ScrapeButton 
                    vendor={selectedVendor}
                    type="scrape"
                    onComplete={handleScrapeComplete}
                    fullWidth={true}
                    showDetails={true}
                  />
                </div>
              </div>

              {/* Shopify Fetching Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Database size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Shopify Sync
                  </h3>
                  <p className="card-subtitle">
                    Fetch data from Shopify for {vendors.find(v => v.value === selectedVendor)?.label}
                  </p>
                </div>
                
                <div className="card-body">
                  <ScrapeButton 
                    vendor={selectedVendor}
                    type="shopify"
                    onComplete={handleScrapeComplete}
                    fullWidth={true}
                    showDetails={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions Card */}
      <div style={{ marginTop: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <BarChart3 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Data Management Guide
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--primary-blue)' }}>
                  Website Scraping
                </h4>
                <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
                  <li>Fetches latest product data from vendor websites</li>
                  <li>Updates existing products and adds new ones</li>
                  <li>Should be run first to get latest product catalog</li>
                  <li>Takes 2-5 minutes depending on catalog size</li>
                </ul>
              </div>
              
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--success)' }}>
                  Shopify Sync
                </h4>
                <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
                  <li>Fetches existing products from your Shopify store</li>
                  <li>Stores data separately for gap analysis</li>
                  <li>Helps identify products not yet listed</li>
                  <li>Takes 1-2 minutes to complete</li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--warning)' }}>
                  Product Listing
                </h4>
                <ul style={{ fontSize: '14px', color: 'var(--gray-600)', margin: 0, paddingLeft: '16px' }}>
                  <li>Use Gap Analysis to find products to list</li>
                  <li>Products can be listed individually or in bulk</li>
                  <li>All listing operations are tracked in history</li>
                  <li>Check Listing History for operation details</li>
                </ul>
              </div>
            </div>
            
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: 'var(--lighter-blue)', 
              borderRadius: '6px',
              border: '1px solid var(--light-blue)'
            }}>
              <strong style={{ fontSize: '14px', color: 'var(--dark-blue)' }}>Best Practice:</strong>
              <span style={{ fontSize: '14px', color: 'var(--gray-700)', marginLeft: '8px' }}>
                Run website scraping first to get the latest product data, then run Shopify sync to enable accurate gap analysis. Use gap analysis to identify and list missing products on Shopify.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;