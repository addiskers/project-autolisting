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
      const response = await api.get('/api/delta/vendors');
      return response.data;
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

// ENHANCED Scraping API with vendor support
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

  // Get scrape status for a vendor
  getScrapeStatus: async (vendor, taskId) => {
    const response = await api.get(`/api/scrape/status/${vendor}/${taskId}`);
    return response.data;
  },

  // Get last scrape information for a vendor
  getLastScrapeInfo: async (vendor) => {
    try {
      const response = await api.get(`/api/scrape/info/${vendor}`);
      return response.data;
    } catch (error) {
      // Return null if no info available
      return null;
    }
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
  },

  // Get vendor info by key
  getVendor: async (vendorKey) => {
    const vendors = await vendorsAPI.getVendors();
    return vendors.find(v => v.value === vendorKey);
  },

  // Get vendor scraping status
  getVendorStatus: async (vendorKey) => {
    try {
      const [scrapingActive, lastScrapeInfo] = await Promise.all([
        scrapingAPI.isScrapingActive(vendorKey),
        scrapingAPI.getLastScrapeInfo(vendorKey)
      ]);
      
      return {
        vendor: vendorKey,
        isScrapingActive: scrapingActive,
        lastScrape: lastScrapeInfo?.lastScrape || null,
        lastShopifyFetch: lastScrapeInfo?.lastShopifyFetch || null
      };
    } catch (error) {
      return {
        vendor: vendorKey,
        isScrapingActive: false,
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

// Utility functions for localStorage management
export const storageUtils = {
  // Save scraping status
  saveScrapeStatus: (vendor, type, status) => {
    const key = `${type}_${vendor}_status`;
    localStorage.setItem(key, status);
  },

  // Get scraping status
  getScrapeStatus: (vendor, type) => {
    const key = `${type}_${vendor}_status`;
    return localStorage.getItem(key);
  },

  // Remove scraping status
  removeScrapeStatus: (vendor, type) => {
    const key = `${type}_${vendor}_status`;
    localStorage.removeItem(key);
  },

  // Save last scrape date
  saveLastScrapeDate: (vendor, type, date = new Date()) => {
    const key = `${type}_${vendor}_lastScrape`;
    localStorage.setItem(key, date.toISOString());
  },

  // Get last scrape date
  getLastScrapeDate: (vendor, type) => {
    const key = `${type}_${vendor}_lastScrape`;
    const dateStr = localStorage.getItem(key);
    return dateStr ? new Date(dateStr) : null;
  },

  // Clear all scrape data for a vendor
  clearVendorScrapeData: (vendor) => {
    const keys = [
      `scrape_${vendor}_status`,
      `scrape_${vendor}_lastScrape`,
      `shopify_${vendor}_status`,
      `shopify_${vendor}_lastScrape`
    ];
    
    keys.forEach(key => localStorage.removeItem(key));
  }
};

export default api;