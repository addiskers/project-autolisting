import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 3100000,
   headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials) => {
    // Simulate login - replace with real API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      const user = { username: 'admin', role: 'admin', name: 'Admin User' };
      const token = 'fake-admin-token';
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return { user, token };
    } else if (credentials.username === 'user' && credentials.password === 'user123') {
      const user = { username: 'user', role: 'user', name: 'Regular User' };
      const token = 'fake-user-token';
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return { user, token };
    } else {
      throw new Error('Invalid credentials');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};

// Products API
export const productsAPI = {
  getProducts: async (params = {}) => {
    const response = await api.get('/api/products', { params });
    return response.data;
  },

  getProduct: async (id) => {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/api/products');
    const products = response.data.products || [];
    
    // Extract unique categories
    const categories = [...new Set(
      products
        .map(product => product.category)
        .filter(category => category)
    )];
    
    return categories.sort();
  }
};

// Delta/Gap Analysis API
export const deltaAPI = {
  // Get delta analysis for a specific vendor
  getDelta: async (vendor) => {
    const response = await api.get(`/api/delta/${vendor}`);
    return response.data;
  },

  // Get available vendors for delta analysis
  getVendors: async () => {
    try {
      const response = await api.get('/api/vendors');
      return response.data.vendors || [];
    } catch (error) {
      // Fallback to hardcoded vendors if endpoint doesn't exist
      return [
        { value: 'phoenix', label: 'Phoenix Tapware' },
        { value: 'hansgrohe', label: 'Hansgrohe' },
        { value: 'moen', label: 'Moen' },
        { value: 'kohler', label: 'Kohler' }
      ];
    }
  }
};

// Shopify Listing API
export const shopifyAPI = {
  // List single product by SKU
  listProduct: async (sku) => {
    const response = await api.post(`/api/list/${sku}`);
    return response.data;
  },

  // List multiple products by SKUs
  listMultipleProducts: async (skus) => {
    const response = await api.post('/api/list/bulk', { skus });
    return response.data;
  },

  // Get listing status
  getListingStatus: async (sku) => {
    const response = await api.get(`/api/list/status/${sku}`);
    return response.data;
  }
};

// UPDATED Scraping API with MongoDB-based status tracking and history
export const scrapingAPI = {
  // Start scraping for a specific vendor
  startScraping: async (vendor) => {
    if (!vendor) {
      throw new Error('Vendor is required for scraping');
    }
    
    const response = await api.post(`/api/scrape/${vendor}`);
    return response.data;
  },

  // Fetch Shopify data for a vendor
  fetchShopifyData: async (vendor) => {
    if (!vendor) {
      throw new Error('Vendor is required for Shopify fetch');
    }
    
    const response = await api.post(`/api/myweb/${vendor}`, {
      vendor: vendor.toUpperCase() // Backend expects uppercase vendor
    });
    return response.data;
  },

  // Check if scraping is currently active for a vendor
  isScrapingActive: async (vendor) => {
    try {
      const response = await api.get(`/api/scrape/active/${vendor}`);
      return response.data.active || false;
    } catch (error) {
      return false;
    }
  },

  // Get last scrape information for a vendor (from MongoDB fetch collection)
  getLastScrapeInfo: async (vendor) => {
    try {
      const response = await api.get(`/api/scrape/info/${vendor}`);
      return response.data;
    } catch (error) {
      // Return null if no info available
      return null;
    }
  },

  // Get vendor status with both scraping and Shopify fetch info
  getVendorStatus: async (vendor) => {
    try {
      const response = await api.get(`/api/vendors/${vendor}/status`);
      return response.data;
    } catch (error) {
      return {
        vendor: vendor,
        isScrapingActive: false,
        isShopifyActive: false,
        lastScrape: null,
        lastShopifyFetch: null,
        error: error.message
      };
    }
  },

  // NEW: Get fetch history for admin dashboard
  getFetchHistory: async (params = {}) => {
    try {
      const response = await api.get('/api/admin/history', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Legacy method for backward compatibility
  startScrapingLegacy: async () => {
    const response = await api.post('/api/scrape');
    return response.data;
  }
};

// Websites API (for admin)
export const websitesAPI = {
  getWebsites: async () => {
    return [
      {
        id: 1,
        name: 'Phoenix Tapware',
        url: 'https://phoenixtapware.com.au',
        status: 'completed',
        lastScrape: '2024-08-24T10:30:00Z',
        productsCount: 1250,
        vendor: 'phoenix'
      },
      {
        id: 2,
        name: 'Hansgrohe',
        url: 'https://hansgrohe.com',
        status: 'pending',
        lastScrape: null,
        productsCount: 0,
        vendor: 'hansgrohe'
      },
      {
        id: 3,
        name: 'Moen',
        url: 'https://moen.com',
        status: 'in-progress',
        lastScrape: '2024-08-24T09:15:00Z',
        productsCount: 580,
        vendor: 'moen'
      },
      {
        id: 4,
        name: 'Kohler',
        url: 'https://kohler.com',
        status: 'completed',
        lastScrape: '2024-08-23T14:20:00Z',
        productsCount: 892,
        vendor: 'kohler'
      }
    ];
  },

  addWebsite: async (websiteData) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      id: Date.now(),
      ...websiteData,
      status: 'pending',
      lastScrape: null,
      productsCount: 0,
      createdAt: new Date().toISOString()
    };
  },

  updateWebsiteStatus: async (id, status) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { id, status };
  },

  // Start scraping for a specific website
  startWebsiteScraping: async (websiteId) => {
    const websites = await websitesAPI.getWebsites();
    const website = websites.find(w => w.id === websiteId);
    
    if (!website) {
      throw new Error('Website not found');
    }
    
    return scrapingAPI.startScraping(website.vendor);
  },

  // Get scraping status for a website
  getWebsiteScrapeStatus: async (websiteId) => {
    const websites = await websitesAPI.getWebsites();
    const website = websites.find(w => w.id === websiteId);
    
    if (!website) {
      throw new Error('Website not found');
    }
    
    return scrapingAPI.isScrapingActive(website.vendor);
  }
};

// Health API
export const healthAPI = {
  getHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Vendors API - centralized vendor management
export const vendorsAPI = {
  // Get all available vendors
  getVendors: async () => {
    try {
      const response = await api.get('/api/vendors');
      return response.data.vendors || [];
    } catch (error) {
      // Fallback to hardcoded vendors
      return [
        { 
          value: 'phoenix', 
          label: 'Phoenix Tapware',
          website: 'https://phoenixtapware.com.au',
          active: true
        },
        { 
          value: 'hansgrohe', 
          label: 'Hansgrohe',
          website: 'https://hansgrohe.com',
          active: true
        },
        { 
          value: 'moen', 
          label: 'Moen',
          website: 'https://moen.com',
          active: true
        },
        { 
          value: 'kohler', 
          label: 'Kohler',
          website: 'https://kohler.com',
          active: true
        }
      ];
    }
  },

  // Get vendor info by key
  getVendor: async (vendorKey) => {
    const vendors = await vendorsAPI.getVendors();
    return vendors.find(v => v.value === vendorKey);
  },

  // Get vendor scraping status (from MongoDB fetch collection)
  getVendorStatus: async (vendorKey) => {
    try {
      return await scrapingAPI.getVendorStatus(vendorKey);
    } catch (error) {
      return {
        vendor: vendorKey,
        isScrapingActive: false,
        isShopifyActive: false,
        lastScrape: null,
        lastShopifyFetch: null,
        error: error.message
      };
    }
  }
};

// Error handler utility
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    return error.response.data?.message || error.response.data?.detail || 'Server error occurred';
  } else if (error.request) {
    // Network error
    return 'Network error - please check your connection';
  } else {
    // Other error
    return error.message || 'An unexpected error occurred';
  }
};

// Utility functions for working with the new MongoDB-based system
export const fetchUtils = {
  // Get formatted last fetch dates
  getLastFetchDates: async (vendor) => {
    try {
      const info = await scrapingAPI.getLastScrapeInfo(vendor);
      return {
        lastScrape: info?.lastScrape ? new Date(info.lastScrape) : null,
        lastShopifyFetch: info?.lastShopifyFetch ? new Date(info.lastShopifyFetch) : null,
        scrapeInfo: info?.scrapeInfo,
        shopifyInfo: info?.shopifyInfo
      };
    } catch (error) {
      return {
        lastScrape: null,
        lastShopifyFetch: null,
        scrapeInfo: null,
        shopifyInfo: null
      };
    }
  },

  // Check if any fetch operation is currently active
  isAnyFetchActive: async (vendor) => {
    try {
      const status = await scrapingAPI.getVendorStatus(vendor);
      return status.isScrapingActive || status.isShopifyActive;
    } catch (error) {
      return false;
    }
  },

  // Format date for display
  formatDate: (date) => {
    if (!date) return null;
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  },

  // Get fetch status with user-friendly messages
  getFetchStatusMessage: async (vendor) => {
    try {
      const status = await scrapingAPI.getVendorStatus(vendor);
      const messages = [];
      
      if (status.isScrapingActive) {
        messages.push('Website scraping is currently running...');
      }
      
      if (status.isShopifyActive) {
        messages.push('Shopify fetch is currently running...');
      }
      
      if (messages.length === 0) {
        if (status.lastScrape || status.lastShopifyFetch) {
          const dates = [];
          if (status.lastScrape) {
            dates.push(`Website: ${fetchUtils.formatDate(status.lastScrape)}`);
          }
          if (status.lastShopifyFetch) {
            dates.push(`Shopify: ${fetchUtils.formatDate(status.lastShopifyFetch)}`);
          }
          messages.push(`Last fetched - ${dates.join(', ')}`);
        } else {
          messages.push('No recent fetch activity');
        }
      }
      
      return messages.join(' ');
    } catch (error) {
      return 'Unable to determine fetch status';
    }
  }
};

export default api;