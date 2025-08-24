import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from '../components/Shared/Header';
import Sidebar from '../components/Shared/Sidebar';
import WebsiteList from '../components/Admin/WebsiteList';
import AddWebsite from '../components/Admin/AddWebsite';
import Dashboard from '../components/Admin/Dashboard';
import { websitesAPI, healthAPI } from '../services/api';
import { Globe, Plus, Activity, Database } from 'lucide-react';

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
      
      // Calculate stats
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
            
            {/* Add Website */}
            <Route
              path="/add-website"
              element={
                <AddWebsite 
                  onWebsiteAdded={handleWebsiteAdded}
                />
              }
            />
            
            {/* Analytics */}
            <Route
              path="/analytics"
              element={<AnalyticsPage stats={stats} websites={websites} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Simple Analytics Component
const AnalyticsPage = ({ stats, websites }) => {
  const statusCounts = websites.reduce((acc, website) => {
    acc[website.status] = (acc[website.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          Analytics
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Website scraping performance and statistics
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Website Status Distribution</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--gray-700)' }}>
                    {status.replace('-', ' ')}:
                  </span>
                  <span className={`status ${
                    status === 'completed' ? 'status-success' :
                    status === 'pending' ? 'status-warning' :
                    status === 'in-progress' ? 'status-info' : 'status-error'
                  }`}>
                    {count} websites
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Products by Website</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {websites
                .filter(w => w.productsCount > 0)
                .sort((a, b) => b.productsCount - a.productsCount)
                .map(website => (
                  <div key={website.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--gray-700)', fontSize: '14px' }}>
                      {website.name}:
                    </span>
                    <span style={{ fontWeight: '600', color: 'var(--primary-blue)' }}>
                      {website.productsCount.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;