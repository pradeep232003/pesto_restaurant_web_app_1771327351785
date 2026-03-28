import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const PaymentMethodsSection = ({ paymentMethods, onAddPaymentMethod, onDeletePaymentMethod, onSetDefaultPaymentMethod }) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    
    if (name?.startsWith('billing.')) {
      const field = name?.split('.')?.[1];
      setFormData(prev => ({
        ...prev,
        billingAddress: {
          ...prev?.billingAddress,
          [field]: value
        }
      }));
    } else {
      let formattedValue = value;
      
      // Format card number
      if (name === 'cardNumber') {
        formattedValue = value?.replace(/\D/g, '')?.replace(/(\d{4})(?=\d)/g, '$1 ')?.trim();
        if (formattedValue?.length > 19) formattedValue = formattedValue?.slice(0, 19);
      }
      
      // Format expiry date
      if (name === 'expiryDate') {
        formattedValue = value?.replace(/\D/g, '')?.replace(/(\d{2})(\d)/, '$1/$2');
        if (formattedValue?.length > 5) formattedValue = formattedValue?.slice(0, 5);
      }
      
      // Format CVV
      if (name === 'cvv') {
        formattedValue = value?.replace(/\D/g, '')?.slice(0, 4);
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    }
    
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
    
    if (!formData?.cardholderName?.trim()) {
      newErrors.cardholderName = 'Cardholder name is required';
    }
    
    if (!formData?.cardNumber?.replace(/\s/g, '')) {
      newErrors.cardNumber = 'Card number is required';
    } else if (formData?.cardNumber?.replace(/\s/g, '')?.length < 13) {
      newErrors.cardNumber = 'Please enter a valid card number';
    }
    
    if (!formData?.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (!/^\d{2}\/\d{2}$/?.test(formData?.expiryDate)) {
      newErrors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
    }
    
    if (!formData?.cvv) {
      newErrors.cvv = 'CVV is required';
    } else if (formData?.cvv?.length < 3) {
      newErrors.cvv = 'Please enter a valid CVV';
    }
    
    if (!formData?.billingAddress?.street?.trim()) {
      newErrors['billing.street'] = 'Billing address is required';
    }
    
    if (!formData?.billingAddress?.city?.trim()) {
      newErrors['billing.city'] = 'City is required';
    }
    
    if (!formData?.billingAddress?.state?.trim()) {
      newErrors['billing.state'] = 'State is required';
    }
    
    if (!formData?.billingAddress?.zipCode?.trim()) {
      newErrors['billing.zipCode'] = 'ZIP code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      const cardType = getCardType(formData?.cardNumber);
      const newPaymentMethod = {
        id: Date.now()?.toString(),
        type: cardType,
        lastFour: formData?.cardNumber?.replace(/\s/g, '')?.slice(-4),
        expiryDate: formData?.expiryDate,
        cardholderName: formData?.cardholderName,
        billingAddress: formData?.billingAddress,
        isDefault: paymentMethods?.length === 0
      };
      
      onAddPaymentMethod(newPaymentMethod);
      resetForm();
      setIsAddingNew(false);
    }
  };

  const resetForm = () => {
    setFormData({
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
      billingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: ''
      }
    });
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    setIsAddingNew(false);
  };

  const getCardType = (cardNumber) => {
    const number = cardNumber?.replace(/\s/g, '');
    if (number?.startsWith('4')) return 'Visa';
    if (number?.startsWith('5') || number?.startsWith('2')) return 'Mastercard';
    if (number?.startsWith('3')) return 'American Express';
    if (number?.startsWith('6')) return 'Discover';
    return 'Credit Card';
  };

  const getCardIcon = (type) => {
    switch (type) {
      case 'Visa':
        return 'CreditCard';
      case 'Mastercard':
        return 'CreditCard';
      case 'American Express':
        return 'CreditCard';
      case 'Discover':
        return 'CreditCard';
      default:
        return 'CreditCard';
    }
  };

  const maskCardNumber = (lastFour) => {
    return `•••• •••• •••• ${lastFour}`;
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Icon name="CreditCard" size={24} color="white" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Payment Methods</h2>
            <p className="text-sm font-body text-muted-foreground">Manage your saved payment methods</p>
          </div>
        </div>
        {!isAddingNew && (
          <Button
            variant="outline"
            iconName="Plus"
            iconPosition="left"
            onClick={() => setIsAddingNew(true)}
          >
            Add Card
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {/* Existing Payment Methods */}
        {paymentMethods?.map((method) => (
          <div key={method?.id} className={`border border-border rounded-lg p-4 ${method?.isDefault ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <Icon name={getCardIcon(method?.type)} size={24} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-base font-body font-medium text-foreground">{method?.type}</h3>
                    {method?.isDefault && (
                      <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-body font-medium rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-body text-muted-foreground">
                    {maskCardNumber(method?.lastFour)}
                  </p>
                  <p className="text-xs font-body text-muted-foreground">
                    Expires {method?.expiryDate} • {method?.cardholderName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!method?.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetDefaultPaymentMethod(method?.id)}
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="Trash2"
                  onClick={() => onDeletePaymentMethod(method?.id)}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add New Payment Method Form */}
        {isAddingNew && (
          <div className="border border-border rounded-lg p-4 bg-background">
            <h3 className="text-lg font-body font-medium text-foreground mb-4">Add New Payment Method</h3>
            <div className="space-y-4">
              <Input
                label="Cardholder Name"
                type="text"
                name="cardholderName"
                value={formData?.cardholderName}
                onChange={handleInputChange}
                error={errors?.cardholderName}
                placeholder="John Doe"
                required
              />
              
              <Input
                label="Card Number"
                type="text"
                name="cardNumber"
                value={formData?.cardNumber}
                onChange={handleInputChange}
                error={errors?.cardNumber}
                placeholder="1234 5678 9012 3456"
                required
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiry Date"
                  type="text"
                  name="expiryDate"
                  value={formData?.expiryDate}
                  onChange={handleInputChange}
                  error={errors?.expiryDate}
                  placeholder="MM/YY"
                  required
                />
                <Input
                  label="CVV"
                  type="text"
                  name="cvv"
                  value={formData?.cvv}
                  onChange={handleInputChange}
                  error={errors?.cvv}
                  placeholder="123"
                  required
                />
              </div>

              <div className="border-t border-border pt-4 mt-6">
                <h4 className="text-base font-body font-medium text-foreground mb-4">Billing Address</h4>
                <div className="space-y-4">
                  <Input
                    label="Street Address"
                    type="text"
                    name="billing.street"
                    value={formData?.billingAddress?.street}
                    onChange={handleInputChange}
                    error={errors?.['billing.street']}
                    placeholder="123 Main Street"
                    required
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="City"
                      type="text"
                      name="billing.city"
                      value={formData?.billingAddress?.city}
                      onChange={handleInputChange}
                      error={errors?.['billing.city']}
                      placeholder="New York"
                      required
                    />
                    <Input
                      label="State"
                      type="text"
                      name="billing.state"
                      value={formData?.billingAddress?.state}
                      onChange={handleInputChange}
                      error={errors?.['billing.state']}
                      placeholder="NY"
                      required
                    />
                    <Input
                      label="ZIP Code"
                      type="text"
                      name="billing.zipCode"
                      value={formData?.billingAddress?.zipCode}
                      onChange={handleInputChange}
                      error={errors?.['billing.zipCode']}
                      placeholder="10001"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button
                  variant="default"
                  iconName="Plus"
                  iconPosition="left"
                  onClick={handleSave}
                >
                  Add Payment Method
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

        {paymentMethods?.length === 0 && !isAddingNew && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="CreditCard" size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-body font-medium text-foreground mb-2">No payment methods</h3>
            <p className="text-sm font-body text-muted-foreground mb-6">
              Add a payment method to make ordering faster and easier
            </p>
            <Button
              variant="default"
              iconName="Plus"
              iconPosition="left"
              onClick={() => setIsAddingNew(true)}
            >
              Add Payment Method
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodsSection;