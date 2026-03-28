import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AccountSecuritySection = ({ user, onUpdateUser }) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handlePasswordInputChange = (e) => {
    const { name, value } = e?.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (passwordErrors?.[name]) {
      setPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev?.[field] }));
  };

  const validatePasswordForm = () => {
    const newErrors = {};
    
    if (!passwordForm?.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!passwordForm?.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordForm?.newPassword?.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/?.test(passwordForm?.newPassword)) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    if (!passwordForm?.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm?.newPassword !== passwordForm?.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (passwordForm?.currentPassword === passwordForm?.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handlePasswordChange = async () => {
    if (validatePasswordForm()) {
      try {
        // Simulate API call for password change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real app, you would make an API call here
        console.log('Password changed successfully');
        
        // Reset form
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setIsChangingPassword(false);
        
        // Show success message
        alert('Password changed successfully!');
      } catch (error) {
        console.error('Error changing password:', error);
        alert('Error changing password. Please try again.');
      }
    }
  };

  const cancelPasswordChange = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordErrors({});
    setIsChangingPassword(false);
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let score = 0;
    if (password?.length >= 8) score++;
    if (/[a-z]/?.test(password)) score++;
    if (/[A-Z]/?.test(password)) score++;
    if (/\d/?.test(password)) score++;
    if (/[^a-zA-Z0-9]/?.test(password)) score++;
    
    if (score <= 2) return { strength: score, label: 'Weak', color: 'text-error' };
    if (score <= 3) return { strength: score, label: 'Fair', color: 'text-warning' };
    if (score <= 4) return { strength: score, label: 'Good', color: 'text-success' };
    return { strength: score, label: 'Strong', color: 'text-success' };
  };

  const passwordStrength = getPasswordStrength(passwordForm?.newPassword);

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <Icon name="Shield" size={20} color="white" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Account Security</h2>
          <p className="text-sm font-body text-muted-foreground">Manage your account security settings</p>
        </div>
      </div>
      <div className="space-y-6">
        {/* Account Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-body font-medium text-muted-foreground">Account ID</label>
            <p className="text-base font-body font-mono text-foreground bg-muted px-3 py-2 rounded-lg">
              {user?.id || 'N/A'}
            </p>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-body font-medium text-muted-foreground">Last Login</label>
            <div className="flex items-center space-x-2">
              <Icon name="Clock" size={16} className="text-success" />
              <p className="text-base font-body text-foreground">
                {user?.lastLogin ? new Date(user?.lastLogin)?.toLocaleString() : 'Never logged in'}
              </p>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-heading font-semibold text-foreground">Password</h3>
              <p className="text-sm font-body text-muted-foreground">Change your account password</p>
            </div>
            
            {!isChangingPassword && (
              <Button
                variant="outline"
                iconName="Key"
                iconPosition="left"
                onClick={() => setIsChangingPassword(true)}
              >
                Change Password
              </Button>
            )}
          </div>

          {isChangingPassword ? (
            <div className="bg-muted rounded-lg p-6 space-y-4">
              <h4 className="text-base font-heading font-semibold text-foreground mb-4">Change Password</h4>
              
              <div className="relative">
                <Input
                  label="Current Password"
                  type={showPassword?.current ? "text" : "password"}
                  name="currentPassword"
                  value={passwordForm?.currentPassword}
                  onChange={handlePasswordInputChange}
                  error={passwordErrors?.currentPassword}
                  placeholder="Enter your current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <Icon name={showPassword?.current ? "EyeOff" : "Eye"} size={16} />
                </button>
              </div>
              
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword?.new ? "text" : "password"}
                  name="newPassword"
                  value={passwordForm?.newPassword}
                  onChange={handlePasswordInputChange}
                  error={passwordErrors?.newPassword}
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <Icon name={showPassword?.new ? "EyeOff" : "Eye"} size={16} />
                </button>
                
                {/* Password Strength Indicator */}
                {passwordForm?.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-border rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength?.strength <= 2 ? 'bg-error' :
                            passwordStrength?.strength <= 3 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${(passwordStrength?.strength / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-body ${passwordStrength?.color}`}>
                        {passwordStrength?.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative">
                <Input
                  label="Confirm New Password"
                  type={showPassword?.confirm ? "text" : "password"}
                  name="confirmPassword"
                  value={passwordForm?.confirmPassword}
                  onChange={handlePasswordInputChange}
                  error={passwordErrors?.confirmPassword}
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-9 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <Icon name={showPassword?.confirm ? "EyeOff" : "Eye"} size={16} />
                </button>
              </div>

              {/* Password Requirements */}
              <div className="bg-background rounded-lg p-4">
                <p className="text-xs font-body font-medium text-foreground mb-2">Password Requirements:</p>
                <ul className="text-xs font-body text-muted-foreground space-y-1">
                  <li className="flex items-center space-x-2">
                    <Icon 
                      name={passwordForm?.newPassword?.length >= 8 ? "Check" : "X"} 
                      size={12} 
                      className={passwordForm?.newPassword?.length >= 8 ? "text-success" : "text-error"} 
                    />
                    <span>At least 8 characters</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon 
                      name={/[a-z]/?.test(passwordForm?.newPassword) ? "Check" : "X"} 
                      size={12} 
                      className={/[a-z]/?.test(passwordForm?.newPassword) ? "text-success" : "text-error"} 
                    />
                    <span>One lowercase letter</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon 
                      name={/[A-Z]/?.test(passwordForm?.newPassword) ? "Check" : "X"} 
                      size={12} 
                      className={/[A-Z]/?.test(passwordForm?.newPassword) ? "text-success" : "text-error"} 
                    />
                    <span>One uppercase letter</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon 
                      name={/\d/?.test(passwordForm?.newPassword) ? "Check" : "X"} 
                      size={12} 
                      className={/\d/?.test(passwordForm?.newPassword) ? "text-success" : "text-error"} 
                    />
                    <span>One number</span>
                  </li>
                </ul>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <Button
                  onClick={handlePasswordChange}
                  iconName="Key"
                  iconPosition="left"
                >
                  Change Password
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelPasswordChange}
                  iconName="X"
                  iconPosition="left"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
                  <Icon name="Check" size={16} color="white" />
                </div>
                <div>
                  <p className="text-sm font-body font-medium text-foreground">Password is secure</p>
                  <p className="text-xs font-body text-muted-foreground">
                    Last changed: Never (using default password)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security Tips */}
        <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="Info" size={14} color="white" />
            </div>
            <div>
              <h4 className="text-sm font-body font-medium text-foreground mb-2">Security Tips</h4>
              <ul className="text-xs font-body text-muted-foreground space-y-1">
                <li>• Use a unique password for your account</li>
                <li>• Don't share your login credentials with others</li>
                <li>• Log out when using shared computers</li>
                <li>• Contact support if you notice suspicious activity</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSecuritySection;