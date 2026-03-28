import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const SecuritySection = ({ onUpdatePassword, onUpdateSecurity }) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: '30'
  });

  const handlePasswordChange = (e) => {
    const { name, value } = e?.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (passwordErrors?.[name]) {
      setPasswordErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validatePasswordForm = () => {
    const errors = {};
    
    if (!passwordForm?.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!passwordForm?.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm?.newPassword?.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/?.test(passwordForm?.newPassword)) {
      errors.newPassword = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!passwordForm?.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm?.newPassword !== passwordForm?.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors)?.length === 0;
  };

  const handlePasswordSubmit = () => {
    if (validatePasswordForm()) {
      onUpdatePassword({
        currentPassword: passwordForm?.currentPassword,
        newPassword: passwordForm?.newPassword
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setIsChangingPassword(false);
    }
  };

  const handleSecurityToggle = (setting, value) => {
    const updatedSettings = {
      ...securitySettings,
      [setting]: value
    };
    setSecuritySettings(updatedSettings);
    onUpdateSecurity(updatedSettings);
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let score = 0;
    if (password?.length >= 8) score++;
    if (/[a-z]/?.test(password)) score++;
    if (/[A-Z]/?.test(password)) score++;
    if (/\d/?.test(password)) score++;
    if (/[^a-zA-Z\d]/?.test(password)) score++;
    
    if (score <= 2) return { strength: score * 20, label: 'Weak', color: 'bg-error' };
    if (score <= 3) return { strength: score * 20, label: 'Fair', color: 'bg-warning' };
    if (score <= 4) return { strength: score * 20, label: 'Good', color: 'bg-primary' };
    return { strength: 100, label: 'Strong', color: 'bg-success' };
  };

  const passwordStrength = getPasswordStrength(passwordForm?.newPassword);

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
          <Icon name="Shield" size={24} color="white" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Security Settings</h2>
          <p className="text-sm font-body text-muted-foreground">Manage your account security</p>
        </div>
      </div>
      <div className="space-y-8">
        {/* Password Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-body font-medium text-foreground flex items-center space-x-2">
              <Icon name="Key" size={20} className="text-primary" />
              <span>Password</span>
            </h3>
            {!isChangingPassword && (
              <Button
                variant="outline"
                size="sm"
                iconName="Edit"
                iconPosition="left"
                onClick={() => setIsChangingPassword(true)}
              >
                Change Password
              </Button>
            )}
          </div>

          {isChangingPassword ? (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
              <Input
                label="Current Password"
                type="password"
                name="currentPassword"
                value={passwordForm?.currentPassword}
                onChange={handlePasswordChange}
                error={passwordErrors?.currentPassword}
                placeholder="Enter your current password"
                required
              />
              
              <div>
                <Input
                  label="New Password"
                  type="password"
                  name="newPassword"
                  value={passwordForm?.newPassword}
                  onChange={handlePasswordChange}
                  error={passwordErrors?.newPassword}
                  placeholder="Enter your new password"
                  required
                />
                {passwordForm?.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs font-body mb-1">
                      <span className="text-muted-foreground">Password strength:</span>
                      <span className={`font-medium ${
                        passwordStrength?.label === 'Weak' ? 'text-error' :
                        passwordStrength?.label === 'Fair' ? 'text-warning' :
                        passwordStrength?.label === 'Good'? 'text-primary' : 'text-success'
                      }`}>
                        {passwordStrength?.label}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${passwordStrength?.color}`}
                        style={{ width: `${passwordStrength?.strength}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <Input
                label="Confirm New Password"
                type="password"
                name="confirmPassword"
                value={passwordForm?.confirmPassword}
                onChange={handlePasswordChange}
                error={passwordErrors?.confirmPassword}
                placeholder="Confirm your new password"
                required
              />

              <div className="flex items-center space-x-3 pt-2">
                <Button
                  variant="default"
                  iconName="Check"
                  iconPosition="left"
                  onClick={handlePasswordSubmit}
                >
                  Update Password
                </Button>
                <Button
                  variant="outline"
                  iconName="X"
                  iconPosition="left"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                    setPasswordErrors({});
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-border rounded-lg bg-background">
              <div className="flex items-center space-x-3">
                <Icon name="Check" size={16} className="text-success" />
                <span className="text-sm font-body text-foreground">
                  Password last updated on October 1, 2024
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Smartphone" size={20} className="text-primary" />
            <span>Two-Factor Authentication</span>
          </h3>
          <div className="p-4 border border-border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-body font-medium text-foreground mb-1">
                  SMS Authentication
                </h4>
                <p className="text-xs font-body text-muted-foreground">
                  Add an extra layer of security to your account with SMS verification
                </p>
              </div>
              <button
                onClick={() => handleSecurityToggle('twoFactorEnabled', !securitySettings?.twoFactorEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  securitySettings?.twoFactorEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    securitySettings?.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {securitySettings?.twoFactorEnabled && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center space-x-2 text-sm font-body text-success">
                  <Icon name="Check" size={16} />
                  <span>Two-factor authentication is enabled</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Login Notifications */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Bell" size={20} className="text-primary" />
            <span>Login Notifications</span>
          </h3>
          <div className="p-4 border border-border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-body font-medium text-foreground mb-1">
                  Email Login Alerts
                </h4>
                <p className="text-xs font-body text-muted-foreground">
                  Get notified when someone logs into your account
                </p>
              </div>
              <button
                onClick={() => handleSecurityToggle('loginNotifications', !securitySettings?.loginNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  securitySettings?.loginNotifications ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    securitySettings?.loginNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Session Timeout */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Clock" size={20} className="text-primary" />
            <span>Session Timeout</span>
          </h3>
          <div className="p-4 border border-border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-body font-medium text-foreground mb-1">
                  Auto-logout after inactivity
                </h4>
                <p className="text-xs font-body text-muted-foreground">
                  Automatically sign out after a period of inactivity
                </p>
              </div>
              <select
                value={securitySettings?.sessionTimeout}
                onChange={(e) => handleSecurityToggle('sessionTimeout', e?.target?.value)}
                className="px-3 py-2 text-sm font-body border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-lg font-body font-medium text-foreground mb-4 flex items-center space-x-2">
            <Icon name="Activity" size={20} className="text-primary" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-3">
            {[
              { action: 'Login', device: 'Chrome on Windows', time: '2 hours ago', location: 'New York, NY' },
              { action: 'Password changed', device: 'Mobile App', time: '1 day ago', location: 'New York, NY' },
              { action: 'Login', device: 'Safari on iPhone', time: '3 days ago', location: 'New York, NY' }
            ]?.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Icon name={activity?.action === 'Login' ? 'LogIn' : 'Key'} size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">{activity?.action}</p>
                    <p className="text-xs font-body text-muted-foreground">
                      {activity?.device} • {activity?.location}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-body text-muted-foreground">{activity?.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySection;