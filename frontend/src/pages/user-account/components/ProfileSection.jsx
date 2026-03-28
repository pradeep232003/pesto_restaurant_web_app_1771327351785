import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const ProfileSection = ({ user, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || ''
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData?.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData?.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData?.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\(\d{3}\) \d{3}-\d{4}$/?.test(formData?.phone)) {
      newErrors.phone = 'Please enter a valid phone number (XXX) XXX-XXXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onUpdateProfile(formData);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      dateOfBirth: user?.dateOfBirth || ''
    });
    setErrors({});
    setIsEditing(false);
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value?.replace(/\D/g, '');
    const match = cleaned?.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match?.[1]}) ${match?.[2]}-${match?.[3]}`;
    }
    return value;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e?.target?.value);
    setFormData(prev => ({
      ...prev,
      phone: formatted
    }));
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Icon name="User" size={24} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Profile Information</h2>
            <p className="text-sm font-body text-muted-foreground">Manage your personal details</p>
          </div>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            iconName="Edit"
            iconPosition="left"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </Button>
        )}
      </div>
      <div className="space-y-6">
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Full Name"
                type="text"
                name="name"
                value={formData?.name}
                onChange={handleInputChange}
                error={errors?.name}
                placeholder="Enter your full name"
                required
              />
              
              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData?.email}
                onChange={handleInputChange}
                error={errors?.email}
                placeholder="Enter your email"
                required
              />
              
              <Input
                label="Phone Number"
                type="tel"
                name="phone"
                value={formData?.phone}
                onChange={handlePhoneChange}
                error={errors?.phone}
                placeholder="(555) 123-4567"
                required
              />
              
              <Input
                label="Date of Birth"
                type="date"
                name="dateOfBirth"
                value={formData?.dateOfBirth}
                onChange={handleInputChange}
                error={errors?.dateOfBirth}
              />
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button
                variant="default"
                iconName="Check"
                iconPosition="left"
                onClick={handleSave}
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                iconName="X"
                iconPosition="left"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Full Name</label>
              <p className="text-base font-body text-foreground">{user?.name || 'Not provided'}</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Email Address</label>
              <p className="text-base font-body text-foreground">{user?.email || 'Not provided'}</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Phone Number</label>
              <p className="text-base font-body text-foreground">{user?.phone || 'Not provided'}</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Date of Birth</label>
              <p className="text-base font-body text-foreground">
                {user?.dateOfBirth ? new Date(user.dateOfBirth)?.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Not provided'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSection;