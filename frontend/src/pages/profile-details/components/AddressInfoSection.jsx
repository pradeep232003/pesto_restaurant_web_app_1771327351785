import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AddressInfoSection = ({ addresses, onUpdateAddresses }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    label: '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    isDefault: false
  });
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setFormData({
      id: null,
      label: '',
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      isDefault: false
    });
    setErrors({});
    setEditingAddressId(null);
    setShowAddForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData?.label?.trim()) {
      newErrors.label = 'Address label is required';
    }
    
    if (!formData?.street?.trim()) {
      newErrors.street = 'Street address is required';
    }
    
    if (!formData?.city?.trim()) {
      newErrors.city = 'City is required';
    }
    
    if (!formData?.state?.trim()) {
      newErrors.state = 'State is required';
    }
    
    if (!formData?.zipCode?.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/?.test(formData?.zipCode)) {
      newErrors.zipCode = 'Please enter a valid ZIP code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      let updatedAddresses = [...addresses];
      
      if (editingAddressId) {
        // Update existing address
        updatedAddresses = addresses?.map(addr => 
          addr?.id === editingAddressId ? { ...formData, id: editingAddressId } : addr
        );
      } else {
        // Add new address
        const newAddress = {
          ...formData,
          id: `addr_${Date.now()}`
        };
        updatedAddresses?.push(newAddress);
      }
      
      // If this address is set as default, remove default from others
      if (formData?.isDefault) {
        updatedAddresses = updatedAddresses?.map(addr => ({
          ...addr,
          isDefault: addr?.id === editingAddressId || addr === updatedAddresses?.[updatedAddresses?.length - 1]
        }));
      }
      
      onUpdateAddresses(updatedAddresses);
      resetForm();
      setIsEditing(false);
    }
  };

  const handleEdit = (address) => {
    setFormData(address);
    setEditingAddressId(address?.id);
    setIsEditing(true);
  };

  const handleDelete = (addressId) => {
    let updatedAddresses = addresses?.filter(addr => addr?.id !== addressId);
    
    // If deleted address was default and there are other addresses, make the first one default
    const wasDefault = addresses?.find(addr => addr?.id === addressId)?.isDefault;
    if (wasDefault && updatedAddresses?.length > 0) {
      updatedAddresses[0].isDefault = true;
    }
    
    onUpdateAddresses(updatedAddresses);
  };

  const handleSetDefault = (addressId) => {
    let updatedAddresses = addresses?.map(addr => ({
      ...addr,
      isDefault: addr?.id === addressId
    }));
    onUpdateAddresses(updatedAddresses);
  };

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
  };

  const startAddingAddress = () => {
    resetForm();
    setShowAddForm(true);
    setIsEditing(true);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Icon name="MapPin" size={20} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Delivery Addresses</h2>
            <p className="text-sm font-body text-muted-foreground">Manage your saved delivery locations</p>
          </div>
        </div>
        
        {!isEditing && (
          <Button
            variant="outline"
            iconName="Plus"
            iconPosition="left"
            onClick={startAddingAddress}
          >
            Add Address
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Existing Addresses */}
        {addresses?.length > 0 && !isEditing && (
          <div className="space-y-4">
            {addresses?.map((address) => (
              <div
                key={address?.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  address?.isDefault 
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-base font-body font-semibold text-foreground">{address?.label}</h3>
                      {address?.isDefault && (
                        <span className="px-2 py-1 text-xs font-body font-medium bg-primary text-primary-foreground rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm font-body text-muted-foreground">
                      <p>{address?.street}</p>
                      {address?.apartment && <p>{address?.apartment}</p>}
                      <p>{address?.city}, {address?.state} {address?.zipCode}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!address?.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconName="Star"
                        onClick={() => handleSetDefault(address?.id)}
                        className="text-muted-foreground hover:text-warning"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="Edit"
                      onClick={() => handleEdit(address)}
                      className="text-muted-foreground hover:text-primary"
                    />
                    {addresses?.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconName="Trash2"
                        onClick={() => handleDelete(address?.id)}
                        className="text-muted-foreground hover:text-error"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {isEditing && (
          <div className="bg-muted rounded-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-heading font-semibold text-foreground">
                {editingAddressId ? 'Edit Address' : 'Add New Address'}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Address Label"
                type="text"
                name="label"
                value={formData?.label}
                onChange={handleInputChange}
                error={errors?.label}
                placeholder="Home, Work, etc."
                required
              />
              
              <div className="md:col-span-2">
                <Input
                  label="Street Address"
                  type="text"
                  name="street"
                  value={formData?.street}
                  onChange={handleInputChange}
                  error={errors?.street}
                  placeholder="123 Main Street"
                  required
                />
              </div>
              
              <Input
                label="Apartment/Suite"
                type="text"
                name="apartment"
                value={formData?.apartment}
                onChange={handleInputChange}
                error={errors?.apartment}
                placeholder="Apt 2B, Suite 200 (optional)"
              />
              
              <Input
                label="City"
                type="text"
                name="city"
                value={formData?.city}
                onChange={handleInputChange}
                error={errors?.city}
                placeholder="New York"
                required
              />
              
              <Input
                label="State"
                type="text"
                name="state"
                value={formData?.state}
                onChange={handleInputChange}
                error={errors?.state}
                placeholder="NY"
                maxLength={2}
                required
              />
              
              <Input
                label="ZIP Code"
                type="text"
                name="zipCode"
                value={formData?.zipCode}
                onChange={handleInputChange}
                error={errors?.zipCode}
                placeholder="12345"
                required
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                name="isDefault"
                checked={formData?.isDefault}
                onChange={handleInputChange}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary/50"
              />
              <label htmlFor="isDefault" className="text-sm font-body font-medium text-foreground">
                Set as default delivery address
              </label>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button
                onClick={handleSave}
                iconName="Check"
                iconPosition="left"
              >
                {editingAddressId ? 'Update Address' : 'Add Address'}
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
          </div>
        )}

        {/* Empty State */}
        {addresses?.length === 0 && !isEditing && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="MapPin" size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No addresses added</h3>
            <p className="text-sm font-body text-muted-foreground mb-6">
              Add your delivery addresses to make ordering faster and easier.
            </p>
            <Button
              onClick={startAddingAddress}
              iconName="Plus"
              iconPosition="left"
            >
              Add Your First Address
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressInfoSection;