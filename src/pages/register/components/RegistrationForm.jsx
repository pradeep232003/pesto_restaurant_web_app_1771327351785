import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';

const RegistrationForm = ({ onRegister }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    subscribeNewsletter: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    // Full name validation
    if (!formData?.fullName?.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData?.fullName?.trim()?.length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData?.email?.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
    if (!formData?.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!phoneRegex?.test(formData?.phone)) {
      newErrors.phone = 'Please enter a valid phone number: (555) 123-4567';
    }

    // Password validation
    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/?.test(formData?.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password validation
    if (!formData?.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms agreement validation
    if (!formData?.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    const checks = {
      length: password?.length >= 8,
      lowercase: /[a-z]/?.test(password),
      uppercase: /[A-Z]/?.test(password),
      number: /\d/?.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/?.test(password)
    };

    strength = Object.values(checks)?.filter(Boolean)?.length;
    
    if (strength <= 2) return { level: 'weak', color: 'bg-error', text: 'Weak' };
    if (strength <= 3) return { level: 'medium', color: 'bg-warning', text: 'Medium' };
    if (strength <= 4) return { level: 'good', color: 'bg-accent', text: 'Good' };
    return { level: 'strong', color: 'bg-success', text: 'Strong' };
  };

  const formatPhoneNumber = (value) => {
    const numbers = value?.replace(/\D/g, '');
    if (numbers?.length <= 3) return numbers;
    if (numbers?.length <= 6) return `(${numbers?.slice(0, 3)}) ${numbers?.slice(3)}`;
    return `(${numbers?.slice(0, 3)}) ${numbers?.slice(3, 6)}-${numbers?.slice(6, 10)}`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    
    let processedValue = value;
    if (name === 'phone') {
      processedValue = formatPhoneNumber(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue
    }));

    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful registration
      const newUser = {
        id: Date.now(),
        name: formData?.fullName,
        email: formData?.email,
        phone: formData?.phone,
        createdAt: new Date()?.toISOString()
      };

      if (onRegister) {
        onRegister(newUser);
      }

      // Navigate to login or home
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please sign in to continue.',
          email: formData?.email 
        }
      });
    } catch (error) {
      setErrors({ submit: 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData?.password);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Full Name */}
      <Input
        label="Full Name"
        type="text"
        name="fullName"
        placeholder="Enter your full name"
        value={formData?.fullName}
        onChange={handleInputChange}
        error={errors?.fullName}
        required
      />
      {/* Email */}
      <Input
        label="Email Address"
        type="email"
        name="email"
        placeholder="Enter your email address"
        value={formData?.email}
        onChange={handleInputChange}
        error={errors?.email}
        description="We'll use this for order confirmations and updates"
        required
      />
      {/* Phone */}
      <Input
        label="Phone Number"
        type="tel"
        name="phone"
        placeholder="(555) 123-4567"
        value={formData?.phone}
        onChange={handleInputChange}
        error={errors?.phone}
        description="For delivery updates and order notifications"
        required
      />
      {/* Password */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Create a strong password"
            value={formData?.password}
            onChange={handleInputChange}
            error={errors?.password}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <Icon name={showPassword ? "EyeOff" : "Eye"} size={20} />
          </button>
        </div>

        {/* Password Strength Indicator */}
        {formData?.password && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${passwordStrength?.color}`}
                  style={{ width: `${(Object.values({
                    length: formData?.password?.length >= 8,
                    lowercase: /[a-z]/?.test(formData?.password),
                    uppercase: /[A-Z]/?.test(formData?.password),
                    number: /\d/?.test(formData?.password),
                    special: /[!@#$%^&*(),.?":{}|<>]/?.test(formData?.password)
                  })?.filter(Boolean)?.length / 5) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${
                passwordStrength?.level === 'weak' ? 'text-error' :
                passwordStrength?.level === 'medium' ? 'text-warning' :
                passwordStrength?.level === 'good' ? 'text-accent' : 'text-success'
              }`}>
                {passwordStrength?.text}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className={formData?.password?.length >= 8 ? 'text-success' : ''}>
                ✓ At least 8 characters
              </p>
              <p className={/[a-z]/?.test(formData?.password) ? 'text-success' : ''}>
                ✓ One lowercase letter
              </p>
              <p className={/[A-Z]/?.test(formData?.password) ? 'text-success' : ''}>
                ✓ One uppercase letter
              </p>
              <p className={/\d/?.test(formData?.password) ? 'text-success' : ''}>
                ✓ One number
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Confirm Password */}
      <div className="relative">
        <Input
          label="Confirm Password"
          type={showConfirmPassword ? "text" : "password"}
          name="confirmPassword"
          placeholder="Confirm your password"
          value={formData?.confirmPassword}
          onChange={handleInputChange}
          error={errors?.confirmPassword}
          required
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <Icon name={showConfirmPassword ? "EyeOff" : "Eye"} size={20} />
        </button>
      </div>
      {/* Terms Agreement */}
      <div className="space-y-4">
        <Checkbox
          label="I agree to the Terms of Service and Privacy Policy"
          checked={formData?.agreeToTerms}
          onChange={(e) => handleInputChange(e)}
          name="agreeToTerms"
          error={errors?.agreeToTerms}
          required
        />

        <Checkbox
          label="Subscribe to newsletter for special offers and updates"
          checked={formData?.subscribeNewsletter}
          onChange={(e) => handleInputChange(e)}
          name="subscribeNewsletter"
          description="Get exclusive deals and menu updates (optional)"
        />
      </div>
      {/* Submit Error */}
      {errors?.submit && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
          <p className="text-error text-sm font-medium">{errors?.submit}</p>
        </div>
      )}
      {/* Submit Button */}
      <Button
        type="submit"
        variant="default"
        size="lg"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
        className="mt-8"
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
      {/* Login Link */}
      <div className="text-center pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
          >
            Sign in here
          </button>
        </p>
      </div>
    </form>
  );
};

export default RegistrationForm;