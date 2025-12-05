import './Skeleton.css';

/**
 * Skeleton loading component for showing loading placeholders
 * Provides various variants for different UI elements
 */

// Base skeleton element
export function Skeleton({ className = '', width, height, style = {}, variant = 'text' }) {
  const variantClass = variant ? `skeleton-${variant}` : '';

  return (
    <div
      className={`skeleton ${variantClass} ${className}`}
      style={{
        width: width,
        height: height,
        ...style
      }}
    />
  );
}

// Skeleton for customer list items
export function CustomerListSkeleton({ count = 5 }) {
  return (
    <div className="skeleton-customer-list">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-customer-item" style={{ animationDelay: `${index * 100}ms` }}>
          <div className="skeleton-customer-info">
            <Skeleton variant="text" className="skeleton-name" />
            <Skeleton variant="text" className="skeleton-vsa" />
            <div className="skeleton-milestone-bar">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="rect" className="skeleton-milestone-segment" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
