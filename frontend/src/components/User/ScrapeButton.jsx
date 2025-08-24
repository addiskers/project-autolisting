import React, { useState } from 'react';
import { scrapingAPI, handleAPIError } from '../../services/api';
import { Download, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';

const ScrapeButton = ({ 
  onComplete, 
  fullWidth = false, 
  showDetails = false 
}) => {
  const [isScrapingActive, setIsScrapingActive] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleStartScraping = async () => {
    setIsScrapingActive(true);
    setError('');
    setScrapeStatus('starting');
    setProgress('Initializing scraping process...');

    try {
      const response = await scrapingAPI.startScraping();
      
      if (response.success) {
        setScrapeStatus('running');
        setProgress('Scraping in progress... This may take a few minutes.');
        
        // Simulate progress updates (since we don't have real-time updates)
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
        
        // Simulate completion after 2 minutes (adjust based on your scraper)
        setTimeout(() => {
          clearInterval(progressInterval);
          setScrapeStatus('completed');
          setProgress('Scraping completed successfully!');
          setIsScrapingActive(false);
          
          if (onComplete) {
            onComplete();
          }
          
          // Reset after showing success
          setTimeout(() => {
            setScrapeStatus(null);
            setProgress('');
          }, 3000);
        }, 120000); // 2 minutes
        
      } else {
        throw new Error(response.error || 'Scraping failed to start');
      }
      
    } catch (err) {
      setError(handleAPIError(err));
      setScrapeStatus('error');
      setIsScrapingActive(false);
      setProgress('');
    }
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
          Scraping...
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
        <Download size={16} />
        Fetch Data
      </>
    );
  };

  const getButtonClass = () => {
    if (scrapeStatus === 'completed') return 'btn-success';
    if (scrapeStatus === 'error') return 'btn-warning';
    return 'btn-primary';
  };

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      <button
        onClick={handleStartScraping}
        disabled={isScrapingActive}
        className={`btn ${getButtonClass()} ${fullWidth ? 'btn-full-width btn-large' : ''}`}
      >
        {getButtonContent()}
      </button>

      {/* Progress and Status */}
      {(progress || error) && (
        <div style={{ marginTop: '16px' }}>
          {progress && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'var(--lighter-blue)',
              border: '1px solid var(--light-blue)',
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
      {showDetails && !isScrapingActive && !progress && !error && (
        <div style={{ 
          marginTop: '16px', 
          fontSize: '14px', 
          color: 'var(--gray-600)' 
        }}>
          Click to start fetching the latest product data from configured websites.
          This process typically takes 2-5 minutes to complete.
        </div>
      )}
    </div>
  );
};

export default ScrapeButton;