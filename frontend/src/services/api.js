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

  getCategories: async (params = {}) => {
    const response = await api.get('/api/products/categories', { params });
    return response.data.categories || [];
  }
};

// Delta/Gap Analysis API
export const deltaAPI = {
  getDelta: async (vendor) => {
    const response = await api.get(`/api/delta/${vendor}`);
    return response.data;
  },

  getVendors: async () => {
    try {
      const response = await api.get('/api/vendors');
      return response.data.vendors || [];
    } catch (error) {
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
  listProduct: async (sku) => {
    const response = await api.post(`/api/list/${sku}`);
    return response.data;
  },

  listMultipleProducts: async (skus) => {
    const response = await api.post('/api/list/bulk', { skus });
    return response.data;
  },

  getListingStatus: async (sku) => {
    const response = await api.get(`/api/list/status/${sku}`);
    return response.data;
  }
};

// Listing History API - CORRECTED VERSION
export const listingAPI = {
  getListingHistory: async (params = {}) => {
    const response = await api.get('/api/list/history', { params });
    if (!response.data.success) {
      throw new Error(response.data.error || response.data.message || 'Failed to get listing history');
    }
    return response.data;
  },

  getListingStats: async () => {
    const response = await api.get('/api/list/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || response.data.message || 'Failed to get listing stats');
    }
    return response.data.data;
  }
};

// Scraping API with MongoDB-based status tracking and history
export const scrapingAPI = {
  startScraping: async (vendor) => {
    if (!vendor) {
      throw new Error('Vendor is required for scraping');
    }
    
    const response = await api.post(`/api/scrape/${vendor}`);
    return response.data;
  },

  fetchShopifyData: async (vendor) => {
    if (!vendor) {
      throw new Error('Vendor is required for Shopify fetch');
    }
    
    const response = await api.post(`/api/myweb/${vendor}`, {
      vendor: vendor.toUpperCase()
    });
    return response.data;
  },

  isScrapingActive: async (vendor) => {
    try {
      const response = await api.get(`/api/scrape/active/${vendor}`);
      return response.data.active || false;
    } catch (error) {
      return false;
    }
  },

  getLastScrapeInfo: async (vendor) => {
    try {
      const response = await api.get(`/api/scrape/info/${vendor}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

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

  getFetchHistory: async (params = {}) => {
    try {
      const response = await api.get('/api/admin/history', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

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
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { id, status };
  },

  startWebsiteScraping: async (websiteId) => {
    const websites = await websitesAPI.getWebsites();
    const website = websites.find(w => w.id === websiteId);
    
    if (!website) {
      throw new Error('Website not found');
    }
    
    return scrapingAPI.startScraping(website.vendor);
  },

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
  getVendors: async () => {
    try {
      const response = await api.get('/api/vendors');
      return response.data.vendors || [];
    } catch (error) {
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

  getVendor: async (vendorKey) => {
    const vendors = await vendorsAPI.getVendors();
    return vendors.find(v => v.value === vendorKey);
  },

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
    return error.response.data?.message || error.response.data?.detail || 'Server error occurred';
  } else if (error.request) {
    return 'Network error - please check your connection';
  } else {
    return error.message || 'An unexpected error occurred';
  }
};

// Utility functions for working with the new MongoDB-based system
export const fetchUtils = {
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

  isAnyFetchActive: async (vendor) => {
    try {
      const status = await scrapingAPI.getVendorStatus(vendor);
      return status.isScrapingActive || status.isShopifyActive;
    } catch (error) {
      return false;
    }
  },

  formatDate: (date) => {
    if (!date) return null;
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  },

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
// Vendor History API
export const vendorHistoryAPI = {
  getVendorHistory: async (vendor, params = {}) => {
    try {
      if (!vendor) {
        throw new Error('Vendor parameter is required');
      }

      const queryParams = new URLSearchParams();
      
      // Add pagination parameters
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      
      // Add filter parameters
      if (params.status_filter && params.status_filter !== 'ALL') {
        queryParams.append('status_filter', params.status_filter);
      }
      if (params.search && params.search.trim()) {
        queryParams.append('search', params.search.trim());
      }

      const url = `/api/vendor-web/${vendor}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await api.get(url);
      
      if (!response.data.success) {
        throw new Error(response.data.message || response.data.detail || 'Failed to get vendor history');
      }
      
      return response.data;
      
    } catch (error) {
      console.error('Error in getVendorHistory:', error);
      throw error;
    }
  },

  testVendorHistoryAPI: async () => {
    try {
      const response = await api.get('/api/vendor-web-test');
      return response.data;
    } catch (error) {
      console.error('Error in testVendorHistoryAPI:', error);
      throw error;
    }
  }
};
export default api;