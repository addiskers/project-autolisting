import React, { useState, useEffect } from 'react';
import { scrapingAPI, handleAPIError } from '../../services/api';
import { Download, CheckCircle, AlertCircle, Clock, RefreshCw, Database } from 'lucide-react';

const ScrapeButton = ({ 
  vendor = '',
  type = 'scrape', // 'scrape' or 'shopify'
  onComplete, 
  fullWidth = false, 
  showDetails = false,
  disabled = false
}) => {
  const [isScrapingActive, setIsScrapingActive] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [lastScrapeDate, setLastScrapeDate] = useState(null);

  // Check for existing scraping status on mount
  useEffect(() => {
    if (vendor) {
      checkExistingStatus();
    }
  }, [vendor]);

  const checkExistingStatus = async () => {
    try {
      const statusKey = `${type}_${vendor}_status`;
      const dateKey = `${type}_${vendor}_lastScrape`;
      
      // Check localStorage for ongoing scraping
      const savedStatus = localStorage.getItem(statusKey);
      const savedDate = localStorage.getItem(dateKey);
      
      if (savedDate) {
        setLastScrapeDate(new Date(savedDate));
      }
      
      if (savedStatus === 'running') {
        setIsScrapingActive(true);
        setScrapeStatus('running');
        setProgress(type === 'shopify' 
          ? 'Fetching products from Shopify...' 
          : 'Scraping in progress...'
        );
      }
    } catch (error) {
      console.error('Error checking existing status:', error);
    }
  };

  const handleStartScraping = async () => {
    if (!vendor) {
      setError('Please select a vendor first');
      return;
    }

    setIsScrapingActive(true);
    setError('');
    setScrapeStatus('starting');
    setProgress(type === 'shopify' ? 'Initializing Shopify fetch...' : 'Initializing scraping process...');

    // Save status to localStorage
    const statusKey = `${type}_${vendor}_status`;
    localStorage.setItem(statusKey, 'starting');

    try {
      let response;
      if (type === 'shopify') {
        response = await scrapingAPI.fetchShopifyData(vendor);
      } else {
        response = await scrapingAPI.startScraping(vendor);
      }
      
      if (response.success) {
        setScrapeStatus('running');
        localStorage.setItem(statusKey, 'running');
        
        if (type === 'shopify') {
          setProgress('Fetching products from Shopify... This may take a few minutes.');
          
          // Simulate Shopify fetch progress
          const progressMessages = [
            'Connecting to Shopify...',
            'Fetching product pages...',
            'Processing product data...',
            'Saving products to database...',
            'Finalizing data sync...'
          ];
          
          let messageIndex = 0;
          const progressInterval = setInterval(() => {
            if (messageIndex < progressMessages.length) {
              setProgress(progressMessages[messageIndex]);
              messageIndex++;
            }
          }, 10000); // Update every 10 seconds
          
          // Simulate completion after 1 minute for Shopify
          setTimeout(() => {
            clearInterval(progressInterval);
            completeProcess();
          }, 60000);
          
        } else {
          setProgress('Scraping in progress... This may take a few minutes.');
          
          // Simulate scraping progress
          const progressMessages = [
            'Connecting to website...',
            'Fetching product pages...',
            'Extracting product data...',
            'Processing and saving products...',
            'Finalizing data...'
          ];
          
          let messageIndex = 0;
          const progressInterval = setInterval(() => {
            if (messageIndex < progressMessages.length) {
              setProgress(progressMessages[messageIndex]);
              messageIndex++;
            }
          }, 15000); // Update every 15 seconds
          
          // Simulate completion after 2 minutes for scraping
          setTimeout(() => {
            clearInterval(progressInterval);
            completeProcess();
          }, 120000);
        }
      } else {
        throw new Error(response.error || 'Process failed to start');
      }
      
    } catch (err) {
      setError(handleAPIError(err));
      setScrapeStatus('error');
      setIsScrapingActive(false);
      setProgress('');
      localStorage.removeItem(statusKey);
    }
  };

  const completeProcess = () => {
    const statusKey = `${type}_${vendor}_status`;
    const dateKey = `${type}_${vendor}_lastScrape`;
    const now = new Date();
    
    setScrapeStatus('completed');
    setProgress(type === 'shopify' ? 'Shopify data fetch completed successfully!' : 'Scraping completed successfully!');
    setIsScrapingActive(false);
    setLastScrapeDate(now);
    
    // Save completion status
    localStorage.removeItem(statusKey);
    localStorage.setItem(dateKey, now.toISOString());
    
    if (onComplete) {
      onComplete();
    }
    
    // Reset after showing success
    setTimeout(() => {
      setScrapeStatus(null);
      setProgress('');
    }, 3000);
  };

  const getButtonContent = () => {
    if (scrapeStatus === 'starting') {
      return (
        <>
          <div className="spinner" style={{ width: '16px', height: '16px' }} />
          Starting...
        </>
      );
    }
    
    if (scrapeStatus === 'running') {
      return (
        <>
          <RefreshCw size={16} className="animate-spin" />
          {type === 'shopify' ? 'Fetching...' : 'Scraping...'}
        </>
      );
    }
    
    if (scrapeStatus === 'completed') {
      return (
        <>
          <CheckCircle size={16} />
          Completed!
        </>
      );
    }
    
    if (scrapeStatus === 'error') {
      return (
        <>
          <AlertCircle size={16} />
          Try Again
        </>
      );
    }
    
    return (
      <>
        {type === 'shopify' ? <Database size={16} /> : <Download size={16} />}
        {type === 'shopify' ? `Fetch from Shopify` : `Fetch Data`}
      </>
    );
  };

  const getButtonClass = () => {
    if (scrapeStatus === 'completed') return 'btn-success';
    if (scrapeStatus === 'error') return 'btn-warning';
    return type === 'shopify' ? 'btn-secondary' : 'btn-primary';
  };

  const formatDate = (date) => {
    if (!date) return null;
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      <button
        onClick={handleStartScraping}
        disabled={disabled || !vendor || isScrapingActive}
        className={`btn ${getButtonClass()} ${fullWidth ? 'btn-full-width btn-large' : ''}`}
      >
        {getButtonContent()}
      </button>

      {/* Last Scrape Date */}
      {lastScrapeDate && !isScrapingActive && !progress && !error && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '12px', 
          color: 'var(--gray-500)',
          textAlign: fullWidth ? 'center' : 'left'
        }}>
          Last {type === 'shopify' ? 'fetched' : 'scraped'}: {formatDate(lastScrapeDate)}
        </div>
      )}

      {/* Progress and Status */}
      {(progress || error) && (
        <div style={{ marginTop: '16px' }}>
          {progress && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: type === 'shopify' ? 'var(--lighter-blue)' : 'var(--lighter-blue)',
              border: `1px solid ${type === 'shopify' ? 'var(--light-blue)' : 'var(--light-blue)'}`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: 'var(--dark-blue)'
            }}>
              {scrapeStatus === 'running' && (
                <Clock size={16} style={{ flexShrink: 0 }} />
              )}
              {scrapeStatus === 'completed' && (
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
              )}
              {progress}
            </div>
          )}
          
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#991b1b',
              marginTop: progress ? '8px' : '0'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Details */}
      {showDetails && !isScrapingActive && !progress && !error && vendor && (
        <div style={{ 
          marginTop: '16px', 
          fontSize: '14px', 
          color: 'var(--gray-600)' 
        }}>
          Click to start {type === 'shopify' ? 'fetching products from Shopify' : 'fetching the latest product data from configured websites'}.
          This process typically takes {type === 'shopify' ? '1-2' : '2-5'} minutes to complete.
        </div>
      )}

      {/* No vendor selected message */}
      {showDetails && !vendor && (
        <div style={{ 
          marginTop: '16px', 
          fontSize: '14px', 
          color: 'var(--gray-500)',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          Please select a vendor above to enable {type === 'shopify' ? 'Shopify fetching' : 'data fetching'}.
        </div>
      )}
    </div>
  );
};

export default ScrapeButton;