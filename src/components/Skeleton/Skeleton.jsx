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

// Skeleton for customer details form
export function CustomerDetailsSkeleton() {
  return (
    <div className="skeleton-details animate-fadeIn">
      <div className="skeleton-section">
        <Skeleton variant="text" className="skeleton-section-title" />
        <div className="skeleton-form-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-form-field" style={{ animationDelay: `${i * 50}ms` }}>
              <Skeleton variant="text" className="skeleton-label" />
              <Skeleton variant="rect" className="skeleton-input" />
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-section">
        <Skeleton variant="text" className="skeleton-section-title" />
        <div className="skeleton-form-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-form-field" style={{ animationDelay: `${(i + 6) * 50}ms` }}>
              <Skeleton variant="text" className="skeleton-label" />
              <Skeleton variant="rect" className="skeleton-input" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Skeleton for document list
export function DocumentListSkeleton({ count = 4 }) {
  return (
    <div className="skeleton-document-list">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-document-item" style={{ animationDelay: `${index * 75}ms` }}>
          <Skeleton variant="rect" className="skeleton-doc-icon" />
          <div className="skeleton-doc-info">
            <Skeleton variant="text" className="skeleton-doc-name" />
            <Skeleton variant="text" className="skeleton-doc-meta" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for milestone tracker
export function MilestoneTrackerSkeleton() {
  return (
    <div className="skeleton-milestone-tracker animate-fadeIn">
      <div className="skeleton-milestone-header">
        <Skeleton variant="text" className="skeleton-milestone-title" />
      </div>
      <div className="skeleton-milestone-steps">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="skeleton-milestone-step" style={{ animationDelay: `${index * 100}ms` }}>
            <Skeleton variant="circle" className="skeleton-step-indicator" />
            <div className="skeleton-step-content">
              <Skeleton variant="text" className="skeleton-step-title" />
              <div className="skeleton-checklist">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="text" className="skeleton-checklist-item" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for cards/tiles
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`skeleton-card-wrapper ${className}`}>
      <Skeleton variant="rect" className="skeleton-card-image" />
      <div className="skeleton-card-content">
        <Skeleton variant="text" className="skeleton-card-title" />
        <Skeleton variant="text" className="skeleton-card-subtitle" />
      </div>
    </div>
  );
}

// Skeleton for tables
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="skeleton-table-th" />
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-table-row" style={{ animationDelay: `${rowIndex * 50}ms` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" className="skeleton-table-td" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
