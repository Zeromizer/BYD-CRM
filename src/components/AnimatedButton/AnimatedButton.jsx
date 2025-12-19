import { useState, useEffect, useCallback, useRef } from 'react';
import './AnimatedButton.css';

/**
 * AnimatedButton - A button with loading and success state animations
 *
 * @param {Object} props
 * @param {string} props.children - Button text/content
 * @param {boolean} props.isLoading - Whether button is in loading state
 * @param {boolean} props.showSuccess - Whether to show success animation after loading
 * @param {string} props.loadingText - Text to show while loading
 * @param {string} props.successText - Text to show on success
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.variant - Button variant: 'primary' | 'secondary' | 'danger' | 'success'
 * @param {function} props.onClick - Click handler (can be async)
 * @param {boolean} props.disabled - Whether button is disabled
 */
function AnimatedButton({
  children,
  isLoading = false,
  showSuccess = true,
  loadingText = 'Saving...',
  successText = 'Saved!',
  className = '',
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  ...props
}) {
  const [buttonState, setButtonState] = useState('idle'); // idle, loading, success
  const [displayText, setDisplayText] = useState(children);
  // Track previous loading state to detect transition from loading to not loading
  const wasLoadingRef = useRef(false);

  // Handle external loading state changes
  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      setButtonState('loading');
      setDisplayText(loadingText);
    } else if (wasLoadingRef.current && showSuccess) {
      // Transition from loading to success (was loading, now not loading)
      wasLoadingRef.current = false;
      setButtonState('success');
      setDisplayText(successText);
      // Reset after success animation
      const timer = setTimeout(() => {
        setButtonState('idle');
        setDisplayText(children);
      }, 1500);
      return () => clearTimeout(timer);
    } else if (wasLoadingRef.current) {
      // Just reset if no success animation
      wasLoadingRef.current = false;
      setButtonState('idle');
      setDisplayText(children);
    }
  }, [isLoading, showSuccess, loadingText, successText, children]);

  // Update display text when children change (and not in special state)
  useEffect(() => {
    if (buttonState === 'idle') {
      setDisplayText(children);
    }
  }, [children, buttonState]);

  const handleClick = useCallback(async (e) => {
    if (disabled || buttonState === 'loading' || buttonState === 'success') return;

    if (onClick) {
      onClick(e);
    }
  }, [onClick, disabled, buttonState]);

  const buttonClasses = [
    'animated-btn',
    `animated-btn-${variant}`,
    buttonState === 'loading' ? 'animated-btn-loading' : '',
    buttonState === 'success' ? 'animated-btn-success' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || buttonState === 'loading'}
      {...props}
    >
      <span className="animated-btn-content">
        {buttonState === 'loading' && (
          <span className="animated-btn-spinner" />
        )}
        {buttonState === 'success' && (
          <span className="animated-btn-checkmark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
        <span className={`animated-btn-text ${buttonState !== 'idle' ? 'animated-btn-text-hidden' : ''}`}>
          {displayText}
        </span>
      </span>

      {/* Ripple effect container */}
      <span className="animated-btn-ripple" />
    </button>
  );
}

/**
 * SaveButton - Specialized button for save operations
 */
export function SaveButton({
  children = 'Save Changes',
  isSubmitting = false,
  hasChanges = true,
  ...props
}) {
  return (
    <AnimatedButton
      variant="primary"
      isLoading={isSubmitting}
      disabled={!hasChanges}
      loadingText="Saving..."
      successText="Saved!"
      {...props}
    >
      {children}
    </AnimatedButton>
  );
}

export default AnimatedButton;
