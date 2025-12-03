import { useState, useRef, useCallback } from 'react';

/**
 * DateInput - Custom date input that always displays dd/mm/yyyy format
 * regardless of browser locale settings.
 *
 * Stores value in ISO format (yyyy-mm-dd) for consistency.
 */
function DateInput({ value, onChange, disabled, id, name, placeholder = 'dd/mm/yyyy' }) {
  const dateInputRef = useRef(null);
  const [textValue, setTextValue] = useState(() => isoToDisplay(value));

  // Convert ISO (yyyy-mm-dd) to display format (dd/mm/yyyy)
  function isoToDisplay(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Convert display format (dd/mm/yyyy) to ISO (yyyy-mm-dd)
  function displayToIso(displayDate) {
    if (!displayDate) return '';
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    // Validate the date parts
    if (!day || !month || !year || year.length !== 4) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle text input change
  const handleTextChange = useCallback((e) => {
    let input = e.target.value;

    // Remove non-numeric characters except slashes
    input = input.replace(/[^\d/]/g, '');

    // Auto-insert slashes as user types
    const digits = input.replace(/\//g, '');
    if (digits.length <= 2) {
      input = digits;
    } else if (digits.length <= 4) {
      input = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      input = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }

    setTextValue(input);

    // Only update the actual value when we have a complete valid date
    if (input.length === 10) {
      const isoDate = displayToIso(input);
      if (isoDate && isValidDate(isoDate)) {
        onChange({ target: { name, value: isoDate } });
      }
    } else if (input === '') {
      onChange({ target: { name, value: '' } });
    }
  }, [name, onChange]);

  // Validate ISO date string
  function isValidDate(isoDate) {
    const date = new Date(isoDate);
    return date instanceof Date && !isNaN(date);
  }

  // Handle blur - validate and format
  const handleBlur = useCallback(() => {
    if (textValue && textValue.length === 10) {
      const isoDate = displayToIso(textValue);
      if (isoDate && isValidDate(isoDate)) {
        // Reformat to ensure consistent display
        setTextValue(isoToDisplay(isoDate));
        onChange({ target: { name, value: isoDate } });
      } else {
        // Invalid date - reset to last valid value
        setTextValue(isoToDisplay(value));
      }
    } else if (textValue === '') {
      onChange({ target: { name, value: '' } });
    } else {
      // Incomplete date - reset to last valid value
      setTextValue(isoToDisplay(value));
    }
  }, [textValue, value, name, onChange]);

  // Handle native date picker change
  const handleDatePickerChange = useCallback((e) => {
    const isoDate = e.target.value;
    setTextValue(isoToDisplay(isoDate));
    onChange({ target: { name, value: isoDate } });
  }, [name, onChange]);

  // Open native date picker
  const openDatePicker = useCallback(() => {
    if (dateInputRef.current && !disabled) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.focus();
    }
  }, [disabled]);

  // Sync text value when prop value changes
  if (isoToDisplay(value) !== textValue && document.activeElement?.id !== id) {
    setTextValue(isoToDisplay(value));
  }

  return (
    <div className="date-input-wrapper">
      <input
        type="text"
        id={id}
        value={textValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={10}
        className="date-input-text"
      />
      <input
        ref={dateInputRef}
        type="date"
        value={value || ''}
        onChange={handleDatePickerChange}
        disabled={disabled}
        className="date-input-native"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="date-input-picker-btn"
        onClick={openDatePicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Open date picker"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0a1 1 0 0 1 1 1v1h6V1a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1V1a1 1 0 0 1 1-1zm10 6H2v8h12V6z"/>
        </svg>
      </button>
    </div>
  );
}

export default DateInput;
