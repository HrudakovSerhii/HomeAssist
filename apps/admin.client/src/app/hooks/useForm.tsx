import { useState, useCallback } from 'react';
import { validateForm, hasFormErrors } from '../utils/validation';

interface UseFormOptions<T> {
  initialValues: T;
  validationSchema?: Record<keyof T, (value: any) => string>;
  onSubmit?: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface UseFormReturn<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  setValue: (field: keyof T, value: any) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setFieldError: (field: keyof T, error: string) => void;
  handleChange: (field: keyof T) => (value: any) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  validate: () => boolean;
  validateField: (field: keyof T) => string;
  reset: () => void;
  resetField: (field: keyof T) => void;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string>>({} as Record<keyof T, string>);
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate derived state
  const isValid = !hasFormErrors(errors);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  // Set a single field value
  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Validate on change if enabled
    if (validateOnChange && validationSchema) {
      const fieldValidator = validationSchema[field];
      if (fieldValidator) {
        const error = fieldValidator(value);
        setErrors(prev => ({ ...prev, [field]: error }));
      }
    }
  }, [validateOnChange, validationSchema]);

  // Set field as touched
  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  // Set field error
  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  // Handle change with field binding
  const handleChange = useCallback((field: keyof T) => {
    return (value: any) => {
      setValue(field, value);
    };
  }, [setValue]);

  // Handle blur with field binding
  const handleBlur = useCallback((field: keyof T) => {
    return () => {
      setFieldTouched(field, true);
      
      // Validate on blur if enabled
      if (validateOnBlur && validationSchema) {
        const fieldValidator = validationSchema[field];
        if (fieldValidator) {
          const error = fieldValidator(values[field]);
          setFieldError(field, error);
        }
      }
    };
  }, [validateOnBlur, validationSchema, values, setFieldTouched, setFieldError]);

  // Validate a single field
  const validateField = useCallback((field: keyof T): string => {
    if (!validationSchema) return '';
    
    const fieldValidator = validationSchema[field];
    if (!fieldValidator) return '';
    
    const error = fieldValidator(values[field]);
    setFieldError(field, error);
    return error;
  }, [validationSchema, values, setFieldError]);

  // Validate entire form
  const validate = useCallback((): boolean => {
    if (!validationSchema) return true;
    
    const validationErrors = validateForm(values, validationSchema);
    setErrors(validationErrors);
    
    return !hasFormErrors(validationErrors);
  }, [validationSchema, values]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = true;
      return acc;
    }, {} as Record<keyof T, boolean>);
    setTouched(allTouched);

    // Validate form
    const isFormValid = validate();
    
    if (!isFormValid || !onSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit]);

  // Reset entire form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string>);
    setTouched({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
  }, [initialValues]);

  // Reset a single field
  const resetField = useCallback((field: keyof T) => {
    setValues(prev => ({ ...prev, [field]: initialValues[field] }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    setTouched(prev => ({ ...prev, [field]: false }));
  }, [initialValues]);

  // Set multiple values at once
  const setFormValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  // Set multiple errors at once
  const setFormErrors = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrors(prev => ({ ...prev, ...newErrors }));
  }, []);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    isDirty,
    setValue,
    setFieldTouched,
    setFieldError,
    handleChange,
    handleBlur,
    handleSubmit,
    validate,
    validateField,
    reset,
    resetField,
    setValues: setFormValues,
    setErrors: setFormErrors,
  };
} 