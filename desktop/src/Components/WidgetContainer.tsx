import React from 'react';

export type WidgetContainerProps = {
  title?: string;
};

const WidgetContainer: React.FC<WidgetContainerProps> = ({ title = 'Widget' }) => {
  return (
    <div
      style={{
        border: '2px solid #007bff',
        borderRadius: '10px',
        padding: '1rem',
        margin: '1rem 0',
        background: '#f8f9fa',
      }}
    >
      <h3 style={{ color: '#007bff', marginBottom: '0.5rem' }}>{title}</h3>
    </div>
  );
};

export default WidgetContainer;
