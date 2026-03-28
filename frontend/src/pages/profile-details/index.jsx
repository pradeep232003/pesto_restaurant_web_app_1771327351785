import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

import ProfileAvatarSection from './components/ProfileAvatarSection';
import PersonalInfoSection from './components/PersonalInfoSection';
import ContactInfoSection from './components/ContactInfoSection';
import AddressInfoSection from './components/AddressInfoSection';
import AccountSecuritySection from './components/AccountSecuritySection';

const ProfileDetails = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    id: "user_001",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 123-4567",
    dateOfBirth: "1990-05-15",
    avatar: "https://images.unsplash.com/photo-1612041719716-8db1f9a7de96",
    avatarAlt: "Profile photo of Sarah Johnson with brown hair and friendly smile",
    joinDate: "2023-03-15",
    lastLogin: "2024-10-15T10:30:00Z",
    bio: "Food enthusiast who loves trying new cuisines and exploring different flavors.",
    preferences: {
      newsletter: true,
      notifications: true,
      marketing: false
    },
    addresses: [
    {
      id: "addr_001",
      label: "Home",
      street: "123 Oak Street",
      apartment: "Apt 2B",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      isDefault: true
    },
    {
      id: "addr_002",
      label: "Work",
      street: "456 Business Ave",
      apartment: "Suite 200",
      city: "New York",
      state: "NY",
      zipCode: "10002",
      isDefault: false
    }]

  });

  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Check authentication
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const currentUser = localStorage.getItem('currentUser');

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Load user data from localStorage if available
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser);
        setUser((prevUser) => ({ ...prevUser, ...userData }));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [navigate]);

  // Save changes handler
  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update localStorage
      localStorage.setItem('currentUser', JSON.stringify(user));

      setHasUnsavedChanges(false);

      // Show success message (you could add a toast notification here)
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user data
  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Update addresses
  const updateAddresses = (addresses) => {
    setUser((prev) => ({ ...prev, addresses }));
    setHasUnsavedChanges(true);
  };

  // Header handlers
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
    navigate('/login');
  };

  // Navigation warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e?.preventDefault();
        e.returnValue = '';
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        onLogout={handleLogout}
        onCartClick={() => navigate('/shopping-cart')}
        onSearch={() => {}}
        onAccountClick={(action) => {
          if (action === 'logout') handleLogout();else
          if (action === 'account') navigate('/user-account');
        }} />


      <div className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 text-sm font-body text-muted-foreground mb-6">
            <button
              onClick={() => navigate('/user-account')}
              className="hover:text-primary transition-colors duration-200">

              My Account
            </button>
            <Icon name="ChevronRight" size={14} />
            <span className="text-foreground">Profile Details</span>
          </div>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Profile Details</h1>
              <p className="text-lg font-body text-muted-foreground mt-1">
                Manage your personal information and preferences
              </p>
            </div>
            
            {hasUnsavedChanges &&
            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                <div className="flex items-center space-x-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
                  <Icon name="AlertCircle" size={16} className="text-warning" />
                  <span className="text-sm font-body text-warning">Unsaved changes</span>
                </div>
                <Button
                onClick={handleSaveChanges}
                disabled={isLoading}
                iconName={isLoading ? "Loader2" : "Check"}
                iconPosition="left"
                className={isLoading ? "animate-spin" : ""}>

                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            }
          </div>

          {/* Profile Content */}
          <div className="space-y-8">
            {/* Profile Avatar Section */}
            <ProfileAvatarSection
              user={user}
              onUpdateUser={updateUser} />


            {/* Personal Information Section */}
            <PersonalInfoSection
              user={user}
              onUpdateUser={updateUser} />


            {/* Contact Information Section */}
            <ContactInfoSection
              user={user}
              onUpdateUser={updateUser} />


            {/* Address Information Section */}
            <AddressInfoSection
              addresses={user?.addresses || []}
              onUpdateAddresses={updateAddresses} />


            {/* Account Security Section */}
            <AccountSecuritySection
              user={user}
              onUpdateUser={updateUser} />

          </div>

          {/* Floating Save Button for Mobile */}
          {hasUnsavedChanges &&
          <div className="fixed bottom-6 right-6 sm:hidden z-40">
              <Button
              onClick={handleSaveChanges}
              disabled={isLoading}
              iconName={isLoading ? "Loader2" : "Check"}
              iconPosition="left"
              size="lg"
              className={`shadow-warm-lg ${isLoading ? "animate-spin" : ""}`}>

                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          }

          {/* Back to Account Button */}
          <div className="mt-12 pt-8 border-t border-border">
            <Button
              variant="outline"
              iconName="ArrowLeft"
              iconPosition="left"
              onClick={() => navigate('/user-account')}>

              Back to My Account
            </Button>
          </div>
        </div>
      </div>
    </div>);

};

export default ProfileDetails;