import React from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CartItem = ({ item, onUpdateQuantity, onRemove, onModify }) => {
  const handleQuantityChange = (newQuantity) => {
    if (newQuantity <= 0) {
      onRemove(item?.id);
    } else {
      onUpdateQuantity(item?.id, newQuantity);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-warm hover:shadow-warm-lg transition-all duration-200">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Item Image */}
        <div className="flex-shrink-0">
          <div className="w-full sm:w-24 h-24 rounded-lg overflow-hidden bg-muted">
            <Image
              src={item?.image}
              alt={item?.imageAlt}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-heading font-bold text-foreground text-lg leading-tight">
                {item?.name}
              </h3>
              
              {item?.customizations && item?.customizations?.length > 0 && (
                <div className="mt-1">
                  <p className="text-sm text-muted-foreground">
                    {item?.customizations?.join(', ')}
                  </p>
                </div>
              )}

              {item?.specialRequests && (
                <div className="mt-1">
                  <p className="text-sm text-muted-foreground italic">
                    Note: {item?.specialRequests}
                  </p>
                </div>
              )}

              {/* Mobile Price */}
              <div className="sm:hidden mt-2">
                <p className="text-lg font-heading font-bold text-primary">
                  ${(item?.price * item?.quantity)?.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  ${item?.price?.toFixed(2)} each
                </p>
              </div>
            </div>

            {/* Desktop Price */}
            <div className="hidden sm:block text-right">
              <p className="text-lg font-heading font-bold text-primary">
                ${(item?.price * item?.quantity)?.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                ${item?.price?.toFixed(2)} each
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
            {/* Quantity Controls */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(item?.quantity - 1)}
                className="w-8 h-8"
              >
                <Icon name="Minus" size={16} />
              </Button>
              
              <span className="font-body font-medium text-foreground min-w-[2rem] text-center">
                {item?.quantity}
              </span>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(item?.quantity + 1)}
                className="w-8 h-8"
              >
                <Icon name="Plus" size={16} />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onModify(item?.id)}
                iconName="Edit2"
                iconPosition="left"
                iconSize={14}
              >
                Modify
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item?.id)}
                iconName="Trash2"
                iconPosition="left"
                iconSize={14}
                className="text-error hover:text-error hover:bg-error/10"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;