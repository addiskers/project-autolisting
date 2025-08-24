import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
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

// Scraping API
export const scrapingAPI = {
  startScraping: async () => {
    const response = await api.post('/api/scrape');
    return response.data;
  },

  getScrapeStatus: async (taskId) => {
    const response = await api.get(`/api/scrape/status/${taskId}`);
    return response.data;
  }
};

// Websites API (for admin)
export const websitesAPI = {
  getWebsites: async () => {
    // Simulate website data - replace with real API
    return [
      {
        id: 1,
        name: 'Phoenix Tapware',
        url: 'https://phoenixtapware.com.au',
        status: 'completed',
        lastScrape: '2024-08-24T10:30:00Z',
        productsCount: 1250
      },
      {
        id: 2,
        name: 'Hansgrohe',
        url: 'https://hansgrohe.com',
        status: 'pending',
        lastScrape: null,
        productsCount: 0
      },
      {
        id: 3,
        name: 'Moen',
        url: 'https://moen.com',
        status: 'in-progress',
        lastScrape: '2024-08-24T09:15:00Z',
        productsCount: 580
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
  }
};

// Health API
export const healthAPI = {
  getHealth: async () => {
    const response = await api.get('/health');
    return response.data;
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

export default api;