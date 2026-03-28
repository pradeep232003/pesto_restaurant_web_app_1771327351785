import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const FooterSection = () => {
  const navigate = useNavigate();
  const currentYear = new Date()?.getFullYear();

  const quickLinks = [
    { label: 'Home', path: '/home-landing' },
    { label: 'Menu', path: '/menu-catalog' },
    { label: 'Cart', path: '/shopping-cart' },
    { label: 'Account', path: '/user-account' }
  ];

  const socialLinks = [
    { name: 'Facebook', icon: 'Facebook', url: '#' },
    { name: 'Instagram', icon: 'Instagram', url: '#' },
    { name: 'Twitter', icon: 'Twitter', url: '#' },
    { name: 'Youtube', icon: 'Youtube', url: '#' }
  ];

  const contactInfo = [
    {
      icon: 'MapPin',
      title: 'Address',
      details: ['123 Flavor Street', 'Foodie District, FD 12345']
    },
    {
      icon: 'Phone',
      title: 'Phone',
      details: ['(555) 123-PESTO', '(555) 123-7378']
    },
    {
      icon: 'Mail',
      title: 'Email',
      details: ['info@pestorestaurant.com', 'orders@pestorestaurant.com']
    },
    {
      icon: 'Clock',
      title: 'Hours',
      details: ['Mon-Thu: 11AM-10PM', 'Fri-Sun: 11AM-11PM']
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <footer className="bg-secondary text-secondary-foreground">
      {/* Newsletter Section */}
      <div className="border-b border-secondary-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h3 className="text-2xl sm:text-3xl font-heading font-bold mb-4">
              Stay Updated with Our <span className="text-accent">Latest Offers</span>
            </h3>
            <p className="text-secondary-foreground/80 font-body mb-8 max-w-2xl mx-auto">
              Subscribe to our newsletter and be the first to know about new menu items, special deals, and exclusive promotions.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 rounded-lg bg-card text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <Button
                variant="default"
                className="bg-accent text-accent-foreground hover:bg-accent/90 px-6 py-3"
                iconName="Send"
                iconPosition="right"
              >
                Subscribe
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
          {/* Brand Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="lg:col-span-1"
          >
            <div className="flex items-center space-x-2 mb-6">
              <img
                src="/assets/images/logo-2-1774630354696.png"
                alt="Jollys Kafe logo"
                className="h-12 w-auto object-contain"
              />
              <div>
                <h2 className="text-2xl font-heading font-bold text-accent">Jollys Kafe</h2>
              </div>
            </div>
            
            <p className="text-secondary-foreground/80 font-body mb-6 leading-relaxed">
              Serving delicious, authentic cuisine with passion and quality ingredients. Your satisfaction is our commitment.
            </p>

            {/* Social Links */}
            <div className="flex space-x-4">
              {socialLinks?.map((social) => (
                <a
                  key={social?.name}
                  href={social?.url}
                  className="w-10 h-10 bg-secondary-foreground/10 rounded-lg flex items-center justify-center hover:bg-accent hover:scale-110 transition-all duration-300 group"
                >
                  <Icon 
                    name={social?.icon} 
                    size={20} 
                    className="text-secondary-foreground/70 group-hover:text-accent-foreground" 
                  />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <h3 className="text-lg font-heading font-bold mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks?.map((link) => (
                <li key={link?.path}>
                  <button
                    onClick={() => handleNavigation(link?.path)}
                    className="text-secondary-foreground/80 hover:text-accent font-body transition-colors duration-200 flex items-center space-x-2 group"
                  >
                    <Icon 
                      name="ArrowRight" 
                      size={14} 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
                    />
                    <span>{link?.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="md:col-span-2 lg:col-span-2"
          >
            <h3 className="text-lg font-heading font-bold mb-6">Contact Information</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              {contactInfo?.map((info) => (
                <div key={info?.title} className="flex space-x-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={info?.icon} size={20} className="text-accent" />
                  </div>
                  <div>
                    <h4 className="font-body font-medium text-secondary-foreground mb-1">
                      {info?.title}
                    </h4>
                    {info?.details?.map((detail, index) => (
                      <p key={index} className="text-secondary-foreground/80 font-body text-sm">
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      {/* Bottom Bar */}
      <div className="border-t border-secondary-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-secondary-foreground/70 font-body text-sm text-center sm:text-left">
              © {currentYear} Jollys Kafe. All rights reserved. Made with ❤️ for food lovers.
            </p>
            
            <div className="flex space-x-6">
              <a href="#" className="text-secondary-foreground/70 hover:text-accent font-body text-sm transition-colors duration-200">
                Privacy Policy
              </a>
              <a href="#" className="text-secondary-foreground/70 hover:text-accent font-body text-sm transition-colors duration-200">
                Terms of Service
              </a>
              <a href="#" className="text-secondary-foreground/70 hover:text-accent font-body text-sm transition-colors duration-200">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;