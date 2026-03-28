import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const ContactInfoSection = ({ user, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
    alternativeEmail: user?.alternativeEmail || '',
    preferences: {
      newsletter: user?.preferences?.newsletter || false,
      notifications: user?.preferences?.notifications || false,
      marketing: user?.preferences?.marketing || false
    }
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePreferenceChange = (preference) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev?.preferences,
        [preference]: !prev?.preferences?.[preference]
      }
    }));
  };

  const handlePhoneChange = (e) => {
    let value = e?.target?.value?.replace(/\D/g, '');
    
    // Format phone number as (XXX) XXX-XXXX
    if (value?.length >= 6) {
      value = `(${value?.slice(0, 3)}) ${value?.slice(3, 6)}-${value?.slice(6, 10)}`;
    } else if (value?.length >= 3) {
      value = `(${value?.slice(0, 3)}) ${value?.slice(3)}`;
    }
    
    setFormData(prev => ({ ...prev, phone: value }));
    
    // Clear error when user starts typing
    if (errors?.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Email validation
    if (!formData?.email?.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Alternative email validation (optional)
    if (formData?.alternativeEmail?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.alternativeEmail)) {
        newErrors.alternativeEmail = 'Please enter a valid alternative email address';
      } else if (formData?.alternativeEmail === formData?.email) {
        newErrors.alternativeEmail = 'Alternative email must be different from primary email';
      }
    }
    
    // Phone validation
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
      onUpdateUser(formData);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      email: user?.email || '',
      phone: user?.phone || '',
      alternativeEmail: user?.alternativeEmail || '',
      preferences: {
        newsletter: user?.preferences?.newsletter || false,
        notifications: user?.preferences?.notifications || false,
        marketing: user?.preferences?.marketing || false
      }
    });
    setErrors({});
    setIsEditing(false);
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return 'Not provided';
    return phone;
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Icon name="Mail" size={20} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Contact Information</h2>
            <p className="text-sm font-body text-muted-foreground">Manage your contact details and communication preferences</p>
          </div>
        </div>
        
        {!isEditing && (
          <Button
            variant="outline"
            iconName="Edit"
            iconPosition="left"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData?.email}
                onChange={handleInputChange}
                error={errors?.email}
                placeholder="Enter your email address"
                required
              />
              
              <Input
                label="Alternative Email"
                type="email"
                name="alternativeEmail"
                value={formData?.alternativeEmail}
                onChange={handleInputChange}
                error={errors?.alternativeEmail}
                placeholder="Enter alternative email (optional)"
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
            </div>

            {/* Communication Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-foreground">Communication Preferences</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors duration-200">
                  <input
                    type="checkbox"
                    checked={formData?.preferences?.newsletter}
                    onChange={() => handlePreferenceChange('newsletter')}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Icon name="Mail" size={16} />
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">Email Newsletter</p>
                      <p className="text-xs font-body text-muted-foreground">Receive our weekly newsletter with updates and offers</p>
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors duration-200">
                  <input
                    type="checkbox"
                    checked={formData?.preferences?.notifications}
                    onChange={() => handlePreferenceChange('notifications')}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Icon name="Bell" size={16} />
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">Order Notifications</p>
                      <p className="text-xs font-body text-muted-foreground">Get notified about your order status and updates</p>
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors duration-200">
                  <input
                    type="checkbox"
                    checked={formData?.preferences?.marketing}
                    onChange={() => handlePreferenceChange('marketing')}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <Icon name="Tag" size={16} />
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">Marketing Communications</p>
                      <p className="text-xs font-body text-muted-foreground">Receive promotional offers and special deals</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button
                onClick={handleSave}
                iconName="Check"
                iconPosition="left"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                iconName="X"
                iconPosition="left"
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-body font-medium text-muted-foreground">Primary Email</label>
                <div className="flex items-center space-x-2">
                  <Icon name="Mail" size={16} className="text-primary" />
                  <p className="text-base font-body text-foreground">{user?.email || 'Not provided'}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-body font-medium text-muted-foreground">Alternative Email</label>
                <div className="flex items-center space-x-2">
                  <Icon name="Mail" size={16} className="text-muted-foreground" />
                  <p className="text-base font-body text-foreground">{user?.alternativeEmail || 'Not provided'}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-body font-medium text-muted-foreground">Phone Number</label>
                <div className="flex items-center space-x-2">
                  <Icon name="Phone" size={16} className="text-primary" />
                  <p className="text-base font-body text-foreground">{formatPhoneDisplay(user?.phone)}</p>
                </div>
              </div>
            </div>

            {/* Communication Preferences Display */}
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-foreground">Communication Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    user?.preferences?.newsletter ? 'bg-success text-success-foreground' : 'bg-border text-muted-foreground'
                  }`}>
                    <Icon name="Mail" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">Newsletter</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {user?.preferences?.newsletter ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    user?.preferences?.notifications ? 'bg-success text-success-foreground' : 'bg-border text-muted-foreground'
                  }`}>
                    <Icon name="Bell" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">Notifications</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {user?.preferences?.notifications ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    user?.preferences?.marketing ? 'bg-success text-success-foreground' : 'bg-border text-muted-foreground'
                  }`}>
                    <Icon name="Tag" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">Marketing</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {user?.preferences?.marketing ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactInfoSection;