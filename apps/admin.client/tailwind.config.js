/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      // Custom color palette from existing design system
      colors: {
        // Primary brand colors
        primary: {
          DEFAULT: '#2563eb', // --primary-color
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Main primary
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        
        // Secondary colors
        secondary: {
          DEFAULT: '#64748b', // --secondary-color
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b', // Main secondary
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        
        // Status colors
        success: {
          DEFAULT: '#10b981', // --success-color
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Main success
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        
        warning: {
          DEFAULT: '#f59e0b', // --warning-color
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Main warning
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        
        error: {
          DEFAULT: '#ef4444', // --error-color
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Main error
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        
        // Background and surface colors
        background: '#f8fafc', // --background-color
        surface: '#ffffff',    // --surface-color
        
        // Text colors
        text: {
          primary: '#1e293b',   // --text-primary
          secondary: '#64748b', // --text-secondary
        },
        
        // Border colors
        border: {
          DEFAULT: '#e2e8f0',   // --border-color
          light: '#f1f5f9',
          dark: '#cbd5e1',
        }
      },
      
      // Typography
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ], // --font-family
      },
      
      // Spacing and sizing
      borderRadius: {
        DEFAULT: '8px', // --border-radius
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      
      // Shadows
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)', // --shadow-sm
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // --shadow-md
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
      },
      
      // Container max widths
      maxWidth: {
        'content': '1400px', // Max width used in main content areas
      },
      
      // Z-index values
      zIndex: {
        'header': '100',
        'modal': '1000',
        'tooltip': '1100',
      },
      
      // Animation and transitions
      transitionDuration: {
        DEFAULT: '200ms',
      },
      
      // Custom spacing for consistent gaps
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
      }
    },
  },
  plugins: [],
} 