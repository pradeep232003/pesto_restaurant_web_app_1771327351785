import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';

const MenuPreviewSection = () => {
  const navigate = useNavigate();

  const menuCategories = [
  {
    id: 1,
    name: "Full English Breakfast",
    description: "Sizzling sausages, crispy bacon, eggs, beans, chopped tomatoes and toast",
    image: "https://www.jollyskafe.com/images/item-menu-1.jpg",
    imageAlt: "Jolly's Kafe Full English Breakfast with sausages, bacon, eggs, beans, tomatoes and toast on a white plate",
    itemCount: 8,
    featured: true,
    color: "bg-primary",
    textColor: "text-primary-foreground"
  },
  {
    id: 2,
    name: "Chicken Burger",
    description: "Crispy chicken burger with melted cheddar, lettuce and mayonnaise, served with fries",
    image: "https://www.jollyskafe.com/images/item-menu-2.jpg",
    imageAlt: "Jolly's Kafe Classic Chicken Burger with golden crispy chicken, cheese and fresh salad in a barm",
    itemCount: 6,
    featured: false,
    color: "bg-accent",
    textColor: "text-accent-foreground"
  },
  {
    id: 3,
    name: "Toasted Teacake",
    description: "Warm, buttery toasted teacake perfectly spiced and filled with juicy currants",
    image: "https://www.jollyskafe.com/images/item-menu-3.jpg",
    imageAlt: "Jolly\'s Kafe warm toasted teacake with butter and jam on a cafe plate",
    itemCount: 4,
    featured: false,
    color: "bg-warning",
    textColor: "text-warning-foreground"
  },
  {
    id: 4,
    name: "Sunday Roast",
    description: "Traditional Sunday Roast with succulent meat, crispy roast potatoes and classic trimmings",
    image: "https://www.jollyskafe.com/images/item-menu-4.jpg",
    imageAlt: "Jolly's Kafe Sunday Roast with roast meat, crispy potatoes, vegetables and gravy on a large plate",
    itemCount: 5,
    featured: false,
    color: "bg-success",
    textColor: "text-success-foreground"
  },
  {
    id: 5,
    name: "Café Specials",
    description: "Popcorn chicken bites, dirty fries, beef lasagne and more cafe favourites",
    image: "https://www.jollyskafe.com/images/item-menu-5.jpg",
    imageAlt: "Jolly\'s Kafe cafe specials including popcorn chicken bites and loaded dirty fries with cheese",
    itemCount: 7,
    featured: false,
    color: "bg-secondary",
    textColor: "text-secondary-foreground"
  },
  {
    id: 6,
    name: "Hot Drinks",
    description: "Expertly brewed coffees, cappuccinos, lattes, mochas and hot chocolate",
    image: "https://www.jollyskafe.com/images/item-menu-6.jpg",
    imageAlt: "Jolly's Kafe hot drinks selection including cappuccino, latte and hot chocolate in ceramic cups",
    itemCount: 9,
    featured: false,
    color: "bg-muted",
    textColor: "text-muted-foreground"
  }];


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
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

  const handleCategoryClick = (category) => {
    navigate('/menu-catalog', { state: { selectedCategory: category?.name } });
  };

  const handleViewFullMenu = () => {
    navigate('/menu-catalog');
  };

  return (
    <section id="menu-preview" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16">

          <div className="inline-flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Icon name="UtensilsCrossed" size={20} className="text-primary" />
            <span className="text-primary font-body font-medium">OUR MENU</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-4">
            Explore Our <span className="text-primary">Delicious</span> Categories
          </h2>
          
          <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto">
            From hearty burgers to fresh salads, discover a world of flavors crafted with passion and the finest ingredients.
          </p>
        </motion.div>

        {/* Menu Categories Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">

          {menuCategories?.map((category) =>
          <motion.div
            key={category?.id}
            variants={cardVariants}
            whileHover={{
              y: -12,
              transition: { duration: 0.3 }
            }}
            onClick={() => handleCategoryClick(category)}
            className="group relative bg-card rounded-2xl overflow-hidden shadow-warm hover:shadow-warm-xl transition-all duration-300 cursor-pointer">

              {/* Featured Badge */}
              {category?.featured &&
            <div className="absolute top-4 left-4 z-20">
                  <div className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-body font-bold uppercase tracking-wide flex items-center space-x-1">
                    <Icon name="Star" size={12} />
                    <span>Featured</span>
                  </div>
                </div>
            }

              {/* Item Count Badge */}
              <div className="absolute top-4 right-4 z-20">
                <div className={`${category?.color} ${category?.textColor} px-3 py-1 rounded-full`}>
                  <span className="text-sm font-body font-bold">{category?.itemCount} items</span>
                </div>
              </div>

              {/* Image */}
              <div className="relative h-56 overflow-hidden">
                <Image
                src={category?.image}
                alt={category?.imageAlt}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="bg-card/90 backdrop-blur-sm rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Icon name="ArrowRight" size={24} className="text-primary" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-heading font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  {category?.name}
                </h3>
                
                <p className="text-muted-foreground font-body mb-4 line-clamp-2">
                  {category?.description}
                </p>

                {/* Action */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-body">
                    View all items
                  </span>
                  <Icon
                  name="ArrowRight"
                  size={18}
                  className="text-primary group-hover:translate-x-1 transition-transform duration-300" />

                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* View Full Menu Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center">

          <Button
            variant="primary"
            size="lg"
            onClick={handleViewFullMenu}
            iconName="Menu"
            iconPosition="left"
            className="px-8 py-4 hover:scale-105 transition-transform duration-200 shadow-warm-lg">

            View Full Menu
          </Button>
        </motion.div>
      </div>
    </section>
  );


};

export default MenuPreviewSection;