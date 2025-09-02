import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { websitesAPI, handleAPIError } from '../../services/api';
import { Globe, Plus, AlertCircle, CheckCircle } from 'lucide-react';

const AddWebsite = ({ onWebsiteAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (error) setError('');
  };

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.url) {
      setError('Please fill in all required fields');
      return;
    }

    if (!validateUrl(formData.url)) {
      setError('Please enter a valid URL (include http:// or https://)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const newWebsite = await websitesAPI.addWebsite(formData);
      
      setSuccess(true);
      if (onWebsiteAdded) {
        onWebsiteAdded(newWebsite);
      }
      
      setFormData({ name: '', url: '', description: '' });
      setTimeout(() => {
        navigate('/admin/websites');
      }, 2000);
      
    } catch (err) {
      setError(handleAPIError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ 
          backgroundColor: 'var(--light-blue)', 
          borderRadius: '50%', 
          width: '64px', 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px' 
        }}>
          <CheckCircle size={32} style={{ color: 'var(--success)' }} />
        </div>
        <h2 style={{ marginBottom: '16px' }}>Website Added Successfully!</h2>
        <p style={{ color: 'var(--gray-600)', marginBottom: '24px' }}>
          The website has been added to the queue with pending status.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
          Redirecting to websites list...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          Add New Website
        </h1>
        <p style={{ color: 'var(--gray-600)' }}>
          Add a new website to the scraping queue
        </p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">Website Details</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="card-body">
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Website Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., Phoenix Tapware"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Website URL *</label>
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                className="form-input"
                placeholder="https://example.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-input"
                rows="3"
                placeholder="Brief description of the website..."
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
            </div>
          </div>

          <div className="card-footer">
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/websites')}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !formData.name || !formData.url}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Website
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWebsite;