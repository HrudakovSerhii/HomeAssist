import React from 'react';

export type DropdownOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type DropdownProps<T = string> = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  allLabel?: string; // For "All Categories", "All Priorities", etc.
  className?: string;
  disabled?: boolean;
};

export const Dropdown = <T = string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  className = '',
  disabled = false,
}: DropdownProps<T>) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const selectClasses = `
    w-full px-3 py-2 border border-gray-300 rounded-md 
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
    bg-white text-gray-900 text-sm
    ${
      disabled
        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
        : 'hover:border-gray-400'
    }
    ${className}
  `.trim();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={selectClasses}
      >
        {/* Default "All" option */}
        <option value="">{allLabel || placeholder || `All ${label}`}</option>

        {/* Dynamic options */}
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
