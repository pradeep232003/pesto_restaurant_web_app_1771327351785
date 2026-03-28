import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const WhyChooseUsSection = () => {
  const features = [
  {
    id: 1,
    icon: "ChefHat",
    title: "Expert Chefs",
    description: "Our experienced chefs bring years of culinary expertise to every dish, ensuring exceptional taste and quality.",
    image: "https://images.unsplash.com/photo-1687089122852-40b29da3f249",
    imageAlt: "Professional chef in white uniform and hat preparing food in modern kitchen"
  },
  {
    id: 2,
    icon: "Leaf",
    title: "Fresh Ingredients",
    description: "We source only the freshest, locally-grown ingredients to guarantee the best flavors in every bite.",
    image: "https://images.unsplash.com/photo-1678831654314-8d68bb47cb0f",
    imageAlt: "Fresh organic vegetables and herbs arranged on wooden cutting board"
  },
  {
    id: 3,
    icon: "Clock",
    title: "Fast Service",
    description: "Quick preparation and delivery without compromising on quality. Your satisfaction is our priority.",
    image: "https://images.unsplash.com/photo-1689916342657-d8db64f47bdd",
    imageAlt: "Delivery person on motorcycle with insulated food delivery bag in urban setting"
  },
  {
    id: 4,
    icon: "Heart",
    title: "Made with Love",
    description: "Every dish is prepared with passion and care, bringing you the authentic taste of home-cooked meals.",
    image: "https://images.unsplash.com/photo-1734918693352-774ff2cd3ae5",
    imageAlt: "Hands carefully plating a gourmet dish with artistic presentation"
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

  const itemVariants = {
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
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16">

          <div className="inline-flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Icon name="Award" size={20} className="text-primary" />
            <span className="text-primary font-body font-medium">WHY CHOOSE US</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-4">
            What Makes Us <span className="text-primary">Special</span>
          </h2>
          
          <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto">
            We're committed to delivering exceptional dining experiences through quality, service, and passion for great food.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {features?.map((feature) =>
          <motion.div
            key={feature?.id}
            variants={itemVariants}
            whileHover={{
              y: -8,
              transition: { duration: 0.3 }
            }}
            className="group bg-card rounded-2xl p-6 shadow-warm hover:shadow-warm-xl transition-all duration-300 text-center">

              {/* Icon */}
              <div className="relative mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <Icon
                  name={feature?.icon}
                  size={32}
                  className="text-primary group-hover:text-primary-foreground transition-colors duration-300" />

                </div>
                
                {/* Background decoration */}
                <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl scale-75 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-heading font-bold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
                {feature?.title}
              </h3>
              
              <p className="text-muted-foreground font-body leading-relaxed">
                {feature?.description}
              </p>

              {/* Hidden image that appears on hover */}
              <div className="mt-4 overflow-hidden rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Image
                src={feature?.image}
                alt={feature?.imageAlt}
                className="w-full h-32 object-cover transform scale-110 group-hover:scale-100 transition-transform duration-500" />

              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-8">

          {[
          { number: "10K+", label: "Happy Customers" },
          { number: "50+", label: "Menu Items" },
          { number: "5★", label: "Average Rating" },
          { number: "24/7", label: "Service Available" }]?.
          map((stat, index) =>
          <div key={index} className="text-center">
              <div className="text-3xl sm:text-4xl font-heading font-bold text-primary mb-2">
                {stat?.number}
              </div>
              <div className="text-muted-foreground font-body">
                {stat?.label}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );


};

export default WhyChooseUsSection;