import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const TestimonialsSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Food Blogger",
    avatar: "https://images.unsplash.com/photo-1618636533948-bb301ef06b31",
    avatarAlt: "Professional headshot of smiling woman with brown hair in casual blue shirt",
    rating: 5,
    text: "Absolutely incredible! The flavors are authentic and the presentation is beautiful. Pesto has become my go-to restaurant for special occasions and casual dining alike.",
    date: "2 days ago"
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    role: "Local Resident",
    avatar: "https://images.unsplash.com/photo-1724128195747-dd25cba7860f",
    avatarAlt: "Professional headshot of Hispanic man with short black hair in navy suit smiling at camera",
    rating: 5,
    text: "The best burger I've ever had! The ingredients are fresh, the service is fast, and the atmosphere is perfect for families. Highly recommend the weekend specials!",
    date: "1 week ago"
  },
  {
    id: 3,
    name: "Emily Chen",
    role: "Business Owner",
    avatar: "https://images.unsplash.com/photo-1684262855358-88f296a2cfc2",
    avatarAlt: "Professional headshot of Asian woman with long black hair in white blazer smiling confidently",
    rating: 5,
    text: "Outstanding quality and service! I order from Pesto for all my business meetings. The food always arrives on time and exceeds expectations. Five stars!",
    date: "3 days ago"
  },
  {
    id: 4,
    name: "David Thompson",
    role: "Chef",
    avatar: "https://images.unsplash.com/photo-1607845046636-dca2447c0dee",
    avatarAlt: "Professional headshot of middle-aged man with beard wearing chef\'s coat in kitchen setting",
    rating: 5,
    text: "As a fellow chef, I appreciate the attention to detail and quality ingredients. The pasta dishes are exceptional and remind me of authentic Italian cuisine.",
    date: "5 days ago"
  }];


  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials?.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials?.length) % testimonials?.length);
  };

  const goToTestimonial = (index) => {
    setCurrentTestimonial(index);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) =>
    <Icon
      key={index}
      name="Star"
      size={16}
      className={index < rating ? "text-accent fill-current" : "text-muted-foreground"} />

    );
  };

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16">

          <div className="inline-flex items-center space-x-2 bg-accent/10 px-4 py-2 rounded-full mb-4">
            <Icon name="MessageCircle" size={20} className="text-accent" />
            <span className="text-accent font-body font-medium">TESTIMONIALS</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-4">
            What Our <span className="text-primary">Customers</span> Say
          </h2>
          
          <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto">
            Don't just take our word for it. Here's what our valued customers have to say about their dining experience.
          </p>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="relative bg-card rounded-3xl shadow-warm-xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="p-8 sm:p-12">

                {/* Quote Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Icon name="Quote" size={32} className="text-primary" />
                  </div>
                </div>

                {/* Rating */}
                <div className="flex justify-center space-x-1 mb-6">
                  {renderStars(testimonials?.[currentTestimonial]?.rating)}
                </div>

                {/* Testimonial Text */}
                <blockquote className="text-xl sm:text-2xl font-body text-foreground text-center leading-relaxed mb-8">
                  "{testimonials?.[currentTestimonial]?.text}"
                </blockquote>

                {/* Author Info */}
                <div className="flex items-center justify-center space-x-4">
                  <div className="relative">
                    <Image
                      src={testimonials?.[currentTestimonial]?.avatar}
                      alt={testimonials?.[currentTestimonial]?.avatarAlt}
                      className="w-16 h-16 rounded-full object-cover shadow-warm" />

                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-2 border-card flex items-center justify-center">
                      <Icon name="Check" size={12} className="text-success-foreground" />
                    </div>
                  </div>
                  
                  <div className="text-center sm:text-left">
                    <h4 className="font-heading font-bold text-foreground">
                      {testimonials?.[currentTestimonial]?.name}
                    </h4>
                    <p className="text-muted-foreground font-body text-sm">
                      {testimonials?.[currentTestimonial]?.role}
                    </p>
                    <p className="text-muted-foreground font-body text-xs">
                      {testimonials?.[currentTestimonial]?.date}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button
              onClick={prevTestimonial}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-card/80 backdrop-blur-sm rounded-full shadow-warm hover:shadow-warm-lg flex items-center justify-center transition-all duration-300 hover:scale-110">

              <Icon name="ChevronLeft" size={20} className="text-foreground" />
            </button>

            <button
              onClick={nextTestimonial}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-card/80 backdrop-blur-sm rounded-full shadow-warm hover:shadow-warm-lg flex items-center justify-center transition-all duration-300 hover:scale-110">

              <Icon name="ChevronRight" size={20} className="text-foreground" />
            </button>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center space-x-2 mt-8">
            {testimonials?.map((_, index) =>
            <button
              key={index}
              onClick={() => goToTestimonial(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentTestimonial ?
              'bg-primary scale-125' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}`
              } />

            )}
          </div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-12">

          <p className="text-muted-foreground font-body mb-6">
            Join thousands of satisfied customers
          </p>
          <Button
            variant="outline"
            size="lg"
            iconName="Star"
            iconPosition="left"
            className="px-8 py-4 hover:scale-105 transition-transform duration-200">

            Leave a Review
          </Button>
        </motion.div>
      </div>
    </section>
  );


};

export default TestimonialsSection;