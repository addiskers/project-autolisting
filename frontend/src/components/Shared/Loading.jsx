import React from 'react';

const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p style={{ color: 'var(--gray-600)', fontSize: '14px' }}>
        {message}
      </p>
    </div>
  );
};

export default Loading;