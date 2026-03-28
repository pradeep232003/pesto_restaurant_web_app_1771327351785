import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ProfileAvatarSection = ({ user, onUpdateUser }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file?.type?.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file?.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    
    try {
      // Simulate file upload process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a temporary URL for preview
      const imageUrl = URL.createObjectURL(file);
      
      // Update user avatar
      onUpdateUser({
        avatar: imageUrl,
        avatarAlt: `Updated profile picture of ${user?.name}`
      });

      console.log('Avatar uploaded successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e?.target?.files?.[0];
    handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    setDragActive(false);
    
    const file = e?.dataTransfer?.files?.[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e?.preventDefault();
    setDragActive(false);
  };

  const removeAvatar = () => {
    onUpdateUser({
      avatar: null,
      avatarAlt: null
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <Icon name="Camera" size={20} color="white" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground">Profile Picture</h2>
          <p className="text-sm font-body text-muted-foreground">Upload and manage your profile picture</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start space-y-6 sm:space-y-0 sm:space-x-8">
        {/* Current Avatar Display */}
        <div className="flex-shrink-0">
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user?.avatar}
                alt={user?.avatarAlt || `Profile picture of ${user?.name}`}
                className="w-32 h-32 rounded-full object-cover border-4 border-border shadow-warm"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold shadow-warm">
                {user?.name ? user?.name?.charAt(0)?.toUpperCase() : user?.email?.charAt(0)?.toUpperCase()}
              </div>
            )}
            
            {/* Loading Overlay */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Icon name="Loader2" size={24} color="white" className="animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Upload Area */}
        <div className="flex-1">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
              dragActive 
                ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Icon name="Upload" size={24} className="text-muted-foreground" />
              </div>
              
              <div>
                <p className="text-sm font-body text-foreground">
                  <strong>Click to upload</strong> or drag and drop
                </p>
                <p className="text-xs font-body text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
              
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  disabled={isUploading}
                  className="hidden"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload">
                  <Button
                    as="span"
                    variant="outline"
                    iconName="Upload"
                    iconPosition="left"
                    disabled={isUploading}
                    className="cursor-pointer"
                  >
                    {isUploading ? 'Uploading...' : 'Choose File'}
                  </Button>
                </label>
                
                {user?.avatar && (
                  <Button
                    variant="ghost"
                    iconName="Trash2"
                    iconPosition="left"
                    onClick={removeAvatar}
                    disabled={isUploading}
                    className="text-error hover:text-error hover:bg-error/10"
                  >
                    Remove Picture
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Upload Guidelines */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-body font-medium text-foreground mb-2">Photo Guidelines:</h4>
            <ul className="text-xs font-body text-muted-foreground space-y-1">
              <li>• Use a clear, recent photo of yourself</li>
              <li>• Square photos work best (1:1 aspect ratio)</li>
              <li>• File size should be under 5MB</li>
              <li>• Supported formats: PNG, JPG, GIF</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatarSection;