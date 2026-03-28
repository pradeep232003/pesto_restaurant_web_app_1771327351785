import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AddressSection = ({ addresses, onAddAddress, onUpdateAddress, onDeleteAddress }) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    label: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    isDefault: false
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      if (editingId) {
        onUpdateAddress(editingId, formData);
        setEditingId(null);
      } else {
        onAddAddress(formData);
        setIsAddingNew(false);
      }
      resetForm();
    }
  };

  const handleEdit = (address) => {
    setFormData({
      label: address?.label,
      street: address?.street,
      city: address?.city,
      state: address?.state,
      zipCode: address?.zipCode,
      isDefault: address?.isDefault
    });
    setEditingId(address?.id);
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
    setEditingId(null);
  };

  const resetForm = () => {
    setFormData({
      label: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      isDefault: false
    });
    setErrors({});
  };

  const handleAddNew = () => {
    resetForm();
    setEditingId(null);
    setIsAddingNew(true);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Icon name="MapPin" size={24} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Delivery Addresses</h2>
            <p className="text-sm font-body text-muted-foreground">Manage your saved addresses</p>
          </div>
        </div>
        {!isAddingNew && !editingId && (
          <Button
            variant="outline"
            iconName="Plus"
            iconPosition="left"
            onClick={handleAddNew}
          >
            Add Address
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {/* Existing Addresses */}
        {addresses?.map((address) => (
          <div key={address?.id} className={`border border-border rounded-lg p-4 ${address?.isDefault ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
            {editingId === address?.id ? (
              <div className="space-y-4">
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
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id={`default-${address?.id}`}
                      name="isDefault"
                      checked={formData?.isDefault}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                    />
                    <label htmlFor={`default-${address?.id}`} className="text-sm font-body text-foreground">
                      Set as default address
                    </label>
                  </div>
                </div>
                
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
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    required
                  />
                  <Input
                    label="ZIP Code"
                    type="text"
                    name="zipCode"
                    value={formData?.zipCode}
                    onChange={handleInputChange}
                    error={errors?.zipCode}
                    placeholder="10001"
                    required
                  />
                </div>

                <div className="flex items-center space-x-3">
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
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-base font-body font-medium text-foreground">{address?.label}</h3>
                    {address?.isDefault && (
                      <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-body font-medium rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-body text-muted-foreground">
                    {address?.street}<br />
                    {address?.city}, {address?.state} {address?.zipCode}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="Edit"
                    onClick={() => handleEdit(address)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="Trash2"
                    onClick={() => onDeleteAddress(address?.id)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add New Address Form */}
        {isAddingNew && (
          <div className="border border-border rounded-lg p-4 bg-background">
            <h3 className="text-lg font-body font-medium text-foreground mb-4">Add New Address</h3>
            <div className="space-y-4">
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
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="default-new"
                    name="isDefault"
                    checked={formData?.isDefault}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                  />
                  <label htmlFor="default-new" className="text-sm font-body text-foreground">
                    Set as default address
                  </label>
                </div>
              </div>
              
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  required
                />
                <Input
                  label="ZIP Code"
                  type="text"
                  name="zipCode"
                  value={formData?.zipCode}
                  onChange={handleInputChange}
                  error={errors?.zipCode}
                  placeholder="10001"
                  required
                />
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="default"
                  iconName="Plus"
                  iconPosition="left"
                  onClick={handleSave}
                >
                  Add Address
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressSection;