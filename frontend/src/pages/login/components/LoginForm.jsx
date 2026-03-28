import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';

const LoginForm = ({ onLogin, isLoading = false }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  // Mock credentials for testing
  const mockCredentials = {
    email: 'john.doe@example.com',
    password: 'password123'
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors((prev) => ({
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

    // Check mock credentials
    if (formData?.email !== mockCredentials?.email || formData?.password !== mockCredentials?.password) {
      setErrors({
        general: `Invalid credentials. Use email: ${mockCredentials?.email} and password: ${mockCredentials?.password}`
      });
      return;
    }

    // Simulate successful login
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: formData?.email,
      avatar: "https://images.unsplash.com/photo-1588178457501-31b7688a41a0",
      avatarAlt: 'Professional headshot of smiling man with short brown hair in navy blazer'
    };

    if (onLogin) {
      await onLogin(mockUser, formData?.rememberMe);
    }

    // Note: Redirect is now handled by the parent component after login completion
  };

  const handleForgotPassword = () => {
    // In a real app, this would navigate to forgot password page
    alert('Forgot password functionality would be implemented here');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General Error Message */}
      {errors?.general &&
      <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <Icon name="AlertCircle" size={20} className="text-error mt-0.5 flex-shrink-0" />
            <p className="text-sm font-body text-error">{errors?.general}</p>
          </div>
        </div>
      }
      {/* Email Input */}
      <Input
        label="Email Address"
        type="email"
        name="email"
        placeholder="Enter your email"
        value={formData?.email}
        onChange={handleInputChange}
        error={errors?.email}
        required
        className="w-full" />

      {/* Password Input */}
      <Input
        label="Password"
        type="password"
        name="password"
        placeholder="Enter your password"
        value={formData?.password}
        onChange={handleInputChange}
        error={errors?.password}
        required
        className="w-full" />

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <Checkbox
          label="Remember me"
          name="rememberMe"
          checked={formData?.rememberMe}
          onChange={handleInputChange} />

        
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-sm font-body font-medium text-primary hover:text-primary/80 transition-colors duration-200">

          Forgot password?
        </button>
      </div>
      {/* Login Button */}
      <Button
        type="submit"
        variant="default"
        size="lg"
        loading={isLoading}
        fullWidth
        className="mt-8">

        Sign In
      </Button>
      {/* Sign Up Link */}
      <div className="text-center pt-4 border-t border-border">
        <p className="text-sm font-body text-muted-foreground">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-medium text-primary hover:text-primary/80 transition-colors duration-200">

            Sign up here
          </button>
        </p>
      </div>
    </form>);

};

export default LoginForm;