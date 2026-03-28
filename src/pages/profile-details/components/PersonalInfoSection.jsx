import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const PersonalInfoSection = ({ user, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    dateOfBirth: user?.dateOfBirth || '',
    bio: user?.bio || ''
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData?.name?.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData?.name?.trim()?.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData?.bio && formData?.bio?.length > 200) {
      newErrors.bio = 'Bio must be less than 200 characters';
    }

    // Validate date of birth (must be at least 13 years old)
    if (formData?.dateOfBirth) {
      const birthDate = new Date(formData?.dateOfBirth);
      const today = new Date();
      let age = today?.getFullYear() - birthDate?.getFullYear();
      const monthDiff = today?.getMonth() - birthDate?.getMonth();
      
      if (age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today?.getDate() < birthDate?.getDate())) {
        newErrors.dateOfBirth = 'You must be at least 13 years old';
      }
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
      name: user?.name || '',
      dateOfBirth: user?.dateOfBirth || '',
      bio: user?.bio || ''
    });
    setErrors({});
    setIsEditing(false);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAge = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today?.getFullYear() - birthDate?.getFullYear();
    const monthDiff = today?.getMonth() - birthDate?.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today?.getDate() < birthDate?.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Icon name="User" size={20} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Personal Information</h2>
            <p className="text-sm font-body text-muted-foreground">Your basic personal details</p>
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
              <div className="md:col-span-2">
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
              </div>
              
              <Input
                label="Date of Birth"
                type="date"
                name="dateOfBirth"
                value={formData?.dateOfBirth}
                onChange={handleInputChange}
                error={errors?.dateOfBirth}
                max={new Date()?.toISOString()?.split('T')?.[0]}
              />
              
              {formData?.dateOfBirth && (
                <div className="flex items-center space-x-2 text-sm font-body text-muted-foreground">
                  <Icon name="Calendar" size={16} />
                  <span>Age: {calculateAge(formData?.dateOfBirth)} years old</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-body font-medium text-foreground mb-2">
                Bio <span className="text-muted-foreground">(Optional)</span>
              </label>
              <textarea
                name="bio"
                value={formData?.bio}
                onChange={handleInputChange}
                placeholder="Tell us a little about yourself..."
                rows={4}
                maxLength={200}
                className={`w-full px-3 py-2 text-sm font-body bg-background border rounded-lg text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 ${
                  errors?.bio ? 'border-error' : 'border-border'
                }`}
              />
              <div className="flex items-center justify-between mt-2">
                {errors?.bio && (
                  <p className="text-sm font-body text-error">{errors?.bio}</p>
                )}
                <p className="text-xs font-body text-muted-foreground ml-auto">
                  {formData?.bio?.length || 0}/200 characters
                </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Full Name</label>
              <p className="text-base font-body text-foreground">{user?.name || 'Not provided'}</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Date of Birth</label>
              <div>
                <p className="text-base font-body text-foreground">{formatDisplayDate(user?.dateOfBirth)}</p>
                {user?.dateOfBirth && (
                  <p className="text-sm font-body text-muted-foreground">
                    {calculateAge(user?.dateOfBirth)} years old
                  </p>
                )}
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-body font-medium text-muted-foreground">Bio</label>
              <p className="text-base font-body text-foreground">
                {user?.bio || 'No bio added yet'}
              </p>
            </div>

            {/* Account Stats */}
            <div className="md:col-span-2 bg-muted rounded-lg p-4">
              <h4 className="text-sm font-body font-medium text-foreground mb-3">Account Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="Calendar" size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">Member since</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {formatDisplayDate(user?.joinDate)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="Clock" size={16} className="text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">Last login</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {user?.lastLogin ? new Date(user?.lastLogin)?.toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalInfoSection;