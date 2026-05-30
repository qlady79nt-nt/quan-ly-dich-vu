import React from 'react';

export const Skeleton = ({ width, height, borderRadius = '0.5rem', style = {}, className = '' }: any) => {
  return (
    <div 
      className={`skeleton-pulse ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px', 
        borderRadius,
        ...style 
      }} 
    />
  );
};

export const CardSkeleton = () => (
  <div className="premium-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Skeleton width="48px" height="48px" borderRadius="12px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton width="60%" height="20px" />
        <Skeleton width="40%" height="16px" />
      </div>
    </div>
    <Skeleton width="100%" height="2px" style={{ margin: '0.5rem 0' }} />
    <Skeleton width="100%" height="40px" />
  </div>
);

export const TableSkeleton = () => (
  <div className="premium-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <Skeleton width="30%" height="24px" style={{ marginBottom: '1rem' }} />
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} style={{ display: 'flex', gap: '1rem', paddingBottom: '1rem', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
        <Skeleton width="25%" height="20px" />
        <Skeleton width="25%" height="20px" />
        <Skeleton width="20%" height="20px" />
        <Skeleton width="30%" height="20px" />
      </div>
    ))}
  </div>
);
