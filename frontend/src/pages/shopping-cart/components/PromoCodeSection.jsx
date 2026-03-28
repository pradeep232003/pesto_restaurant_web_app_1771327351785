import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const PromoCodeSection = ({ onApplyPromo, appliedPromo, onRemovePromo }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');

  const handleApplyPromo = async () => {
    if (!promoCode?.trim()) {
      setError('Please enter a promo code');
      return;
    }

    setIsApplying(true);
    setError('');

    try {
      const result = await onApplyPromo(promoCode?.trim()?.toUpperCase());
      if (result?.success) {
        setPromoCode('');
      } else {
        setError(result?.message || 'Invalid promo code');
      }
    } catch (err) {
      setError('Failed to apply promo code');
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemovePromo = () => {
    onRemovePromo();
    setError('');
  };

  const handleKeyPress = (e) => {
    if (e?.key === 'Enter') {
      handleApplyPromo();
    }
  };

  if (appliedPromo) {
    return (
      <div className="bg-success/10 border border-success/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
              <Icon name="Check" size={16} className="text-success-foreground" />
            </div>
            <div>
              <p className="font-body font-medium text-success">
                Promo code applied!
              </p>
              <p className="font-body text-sm text-success/80">
                {appliedPromo?.code} - {appliedPromo?.description}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemovePromo}
            iconName="X"
            iconPosition="left"
            iconSize={14}
            className="text-success hover:text-success hover:bg-success/10"
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Icon name="Tag" size={16} className="text-accent" />
        <h3 className="font-body font-medium text-foreground">
          Have a promo code?
        </h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Enter promo code"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e?.target?.value?.toUpperCase());
              setError('');
            }}
            onKeyPress={handleKeyPress}
            error={error}
            className="text-sm"
          />
        </div>
        
        <Button
          variant="outline"
          size="default"
          loading={isApplying}
          onClick={handleApplyPromo}
          disabled={!promoCode?.trim()}
          className="sm:w-auto w-full"
        >
          Apply
        </Button>
      </div>
      {/* Available Promo Codes Hint */}
      <div className="mt-3 p-3 bg-accent/10 rounded border border-accent/20">
        <p className="font-body text-xs text-muted-foreground mb-2">
          Available promo codes:
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="bg-accent/20 text-accent-foreground px-2 py-1 rounded text-xs font-mono">
            SAVE10
          </span>
          <span className="bg-accent/20 text-accent-foreground px-2 py-1 rounded text-xs font-mono">
            FIRST20
          </span>
          <span className="bg-accent/20 text-accent-foreground px-2 py-1 rounded text-xs font-mono">
            WELCOME15
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromoCodeSection;