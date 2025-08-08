// src/components/AutoResizingTextarea.jsx
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { useAutoResizeAndSubmit } from '../../hooks/useAutoResizeAndSubmit';

/**
 * Componente <AutoResizingTextarea>:
 *
 * Props:
 *  - value, onChange, onSubmit, disabled, placeholder
 *  - className (opcional), style (opcional), rows (default 1)
 */
const AutoResizingTextarea = forwardRef(
  ({ value, onChange, onSubmit, disabled, placeholder, className, style, rows = 1 }, ref) => {
    // Usa o hook para auto‐resize e submit via Enter
    useAutoResizeAndSubmit(ref, onSubmit, [value]);

    return (
      <textarea
        ref={ref}
        className={className}
        style={style}
        rows={rows}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
      />
    );
  }
);

AutoResizingTextarea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  rows: PropTypes.number,
};

AutoResizingTextarea.displayName = 'AutoResizingTextarea';

export default AutoResizingTextarea;
