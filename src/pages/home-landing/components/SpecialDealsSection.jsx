import React from 'react';
import { motion } from 'framer-motion';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';

const SpecialDealsSection = ({ onViewDeal }) => {
  const specialDeals = [
  {
    id: 1,
    title: "WEEKEND SPECIAL",
    subtitle: "Buy 2 Get 1 FREE",
    description: "Get a free appetizer when you order any two main courses this weekend!",
    image: "https://www.jollyskafe.com/images/item-menu-1.jpg",
    imageAlt: "Jolly's Kafe Full English Breakfast with sausages, bacon, eggs, beans, tomatoes and toast",
    discount: "33% OFF",
    validUntil: "Oct 16, 2024",
    isNew: true,
    bgColor: "bg-accent",
    textColor: "text-accent-foreground"
  },
  {
    id: 2,
    title: "LUNCH COMBO",
    subtitle: "Perfect Midday Meal",
    description: "Burger + Fries + Drink combo at an unbeatable price. Available 11 AM - 3 PM daily.",
    image: "https://www.jollyskafe.com/images/item-menu-2.jpg",
    imageAlt: "Jolly's Kafe Classic Chicken Burger with golden crispy chicken, cheese and fresh salad served with fries",
    discount: "£12.99",
    validUntil: "Daily Special",
    isNew: false,
    bgColor: "bg-warning",
    textColor: "text-warning-foreground"
  },
  {
    id: 3,
    title: "FAMILY FEAST",
    subtitle: "Feed the Whole Family",
    description: "Large sharing platter, garlic bread, salad, and drinks. Perfect for family dinner nights!",
    image: "https://www.jollyskafe.com/images/item-menu-4.jpg",
    imageAlt: "Jolly's Kafe Sunday Roast with succulent meat, crispy roast potatoes and all the classic trimmings",
    discount: "SAVE £15",
    validUntil: "Oct 20, 2024",
    isNew: true,
    bgColor: "bg-success",
    textColor: "text-success-foreground"
  }];


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <section className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12">

          <div className="inline-flex items-center space-x-2 bg-accent/10 px-4 py-2 rounded-full mb-4">
            <Icon name="Zap" size={20} className="text-accent" />
            <span className="text-accent font-body font-medium">LIMITED TIME OFFERS</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-4">
            Special <span className="text-primary">Deals</span> This Week
          </h2>
          
          <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto">
            Don't miss out on these amazing offers! Limited time deals that bring you the best value for your favorite meals.
          </p>
        </motion.div>

        {/* Deals Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

          {specialDeals?.map((deal) =>
          <motion.div
            key={deal?.id}
            variants={cardVariants}
            whileHover={{
              y: -8,
              transition: { duration: 0.3 }
            }}
            className="group relative bg-card rounded-2xl overflow-hidden shadow-warm hover:shadow-warm-xl transition-all duration-300">

              {/* New Badge */}
              {deal?.isNew &&
            <div className="absolute top-4 left-4 z-20">
                  <div className="bg-error text-error-foreground px-3 py-1 rounded-full text-xs font-body font-bold uppercase tracking-wide">
                    NEW
                  </div>
                </div>
            }

              {/* Discount Badge */}
              <div className={`absolute top-4 right-4 z-20 ${deal?.bgColor} ${deal?.textColor} px-3 py-1 rounded-full`}>
                <span className="text-sm font-body font-bold">{deal?.discount}</span>
              </div>

              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <Image
                src={deal?.image}
                alt={deal?.imageAlt}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-3">
                  <h3 className="text-xl font-heading font-bold text-foreground mb-1">
                    {deal?.title}
                  </h3>
                  <p className="text-primary font-body font-medium">
                    {deal?.subtitle}
                  </p>
                </div>

                <p className="text-muted-foreground font-body mb-4 line-clamp-2">
                  {deal?.description}
                </p>

                {/* Valid Until */}
                <div className="flex items-center space-x-2 mb-4">
                  <Icon name="Clock" size={16} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-body">
                    Valid until: {deal?.validUntil}
                  </span>
                </div>

                {/* Action Button */}
                <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDeal(deal)}
                iconName="ArrowRight"
                iconPosition="right"
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">

                  Claim Deal
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* View All Deals Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-12">

          <Button
            variant="secondary"
            size="lg"
            onClick={() => onViewDeal('all')}
            iconName="Gift"
            iconPosition="left"
            className="px-8 py-4 hover:scale-105 transition-transform duration-200">

            View All Deals
          </Button>
        </motion.div>
      </div>
    </section>
  );


};

export default SpecialDealsSection;