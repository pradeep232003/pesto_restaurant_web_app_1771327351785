import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const HeroSection = ({ onOrderNow }) => {
  const navigate = useNavigate();

  const handleReservation = () => {
    navigate('/table-reservation');
  };

  // Floating animation variants for food items
  const floatingVariants = {
    float1: {
      y: [0, -20, 0],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    float2: {
      y: [0, -15, 0],
      rotate: [0, -3, 3, 0],
      transition: {
        duration: 3.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.5
      }
    },
    float3: {
      y: [0, -25, 0],
      rotate: [0, 8, -8, 0],
      transition: {
        duration: 4.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 1
      }
    },
    float4: {
      y: [0, -18, 0],
      rotate: [0, -6, 6, 0],
      transition: {
        duration: 3.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 1.5
      }
    },
    float5: {
      y: [0, -22, 0],
      rotate: [0, 4, -4, 0],
      transition: {
        duration: 4.2,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 2
      }
    },
    float6: {
      y: [0, -16, 0],
      rotate: [0, -7, 7, 0],
      transition: {
        duration: 3.6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.8
      }
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/bg-menu-2-1774637132793.jpg"
          alt="Jolly's Kafe food spread featuring classic English breakfast dishes, burgers and cafe meals on a wooden table"
          className="w-full h-full object-cover"
        />
        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-black/50"></div>
      </div>
      {/* Floating Food Items */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        {/* Pizza Slice - Top Left */}
        <motion.div
          className="absolute top-20 left-8 text-6xl opacity-80"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.8, scale: 1, ...floatingVariants?.float1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          🍕
        </motion.div>

        {/* Burger - Top Right */}
        <motion.div
          className="absolute top-32 right-12 text-5xl opacity-75"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.75, scale: 1, ...floatingVariants?.float2 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          🍔
        </motion.div>

        {/* Taco - Middle Left */}
        <motion.div
          className="absolute top-1/2 left-16 text-4xl opacity-70"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.7, scale: 1, ...floatingVariants?.float3 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          🌮
        </motion.div>

        {/* Pasta - Middle Right */}
        <motion.div
          className="absolute top-1/3 right-20 text-5xl opacity-75"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.75, scale: 1, ...floatingVariants?.float4 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          🍝
        </motion.div>

        {/* Donut - Bottom Left */}
        <motion.div
          className="absolute bottom-40 left-12 text-4xl opacity-65"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.65, scale: 1, ...floatingVariants?.float5 }}
          transition={{ delay: 1.7, duration: 0.6 }}
        >
          🍩
        </motion.div>

        {/* Ice Cream - Bottom Right */}
        <motion.div
          className="absolute bottom-52 right-16 text-5xl opacity-70"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.7, scale: 1, ...floatingVariants?.float6 }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          🍦
        </motion.div>

        {/* Additional smaller floating items for mobile responsiveness */}
        <motion.div
          className="absolute top-1/4 left-1/4 text-3xl opacity-50 hidden sm:block"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.5, scale: 1, ...floatingVariants?.float1 }}
          transition={{ delay: 2.3, duration: 0.6 }}
        >
          🥗
        </motion.div>

        <motion.div
          className="absolute bottom-1/3 right-1/3 text-3xl opacity-55 hidden sm:block"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.55, scale: 1, ...floatingVariants?.float2 }}
          transition={{ delay: 2.6, duration: 0.6 }}
        >
          🍰
        </motion.div>
      </div>
      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 8rem)', paddingTop: '4rem', paddingBottom: '8rem' }}>
          
          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-7xl font-heading font-bold text-white leading-tight mb-6 drop-shadow-2xl"
          >
            Welcome to Jolly's Kafe
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-2xl sm:text-3xl text-orange-300 font-semibold mb-6 drop-shadow-lg"
          >
            Our passion is in our Food
          </motion.p>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mb-12 max-w-2xl mx-auto"
          >
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed drop-shadow-md">
              We are a family run cafe who desire to connect with the neighbourhood by offering high quality traditional English Food
            </p>
          </motion.div>

          {/* Call to Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/menu-catalog')}
              className="text-lg px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg shadow-2xl hover:scale-105 transition-all duration-300 border-0 uppercase tracking-wide"
            >
              View All Menu
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleReservation}
              className="text-lg px-8 py-4 border-2 border-white text-white hover:bg-white hover:text-gray-900 font-bold rounded-lg shadow-2xl hover:scale-105 transition-all duration-300"
            >
              Make Reservation
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={onOrderNow}
              className="text-lg px-8 py-4 border-2 border-orange-400 text-orange-300 hover:bg-orange-500 hover:text-white hover:border-orange-500 font-bold rounded-lg shadow-2xl hover:scale-105 transition-all duration-300"
            >
              Order Online
            </Button>
          </motion.div>

        </div>
      </div>
      {/* Paintbrush Transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden z-10">
        <svg
          viewBox="0 0 1200 120"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C300,120 600,0 900,60 C1050,90 1150,30 1200,60 L1200,120 L0,120 Z"
            fill="var(--color-background)"
            className="drop-shadow-lg"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;