import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import RestaurantSelector from './components/RestaurantSelector';
import DateTimePicker from './components/DateTimePicker';
import ReservationForm from './components/ReservationForm';
import ConfirmationModal from './components/ConfirmationModal';
import Icon from '../../components/AppIcon';
import { useLocation2 } from '../../contexts/LocationContext';

const TableReservation = () => {
  const navigate = useNavigate();
  const { selectedLocation } = useLocation2();
  const [cartCount] = useState(3);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reservationData, setReservationData] = useState({
    guestCount: 2,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
    seatingPreference: 'no-preference',
    accessibilityNeeds: false
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock restaurant data
  const restaurants = [
  {
    id: 'downtown',
    name: 'Pesto Downtown',
    address: '123 Main Street, Downtown District',
    hours: 'Mon-Sun: 11:00 AM - 10:00 PM',
    capacity: 120,
    image: "https://images.unsplash.com/photo-1672870634122-6ea7b16d2bb4",
    imageAlt: 'Modern restaurant interior with warm lighting and elegant table settings',
    phone: '(555) 123-4567',
    features: ['Valet Parking', 'Wine Bar', 'Private Dining']
  },
  {
    id: 'waterfront',
    name: 'Pesto Waterfront',
    address: '456 Harbor View, Marina District',
    hours: 'Mon-Sun: 5:00 PM - 11:00 PM',
    capacity: 80,
    image: "https://images.unsplash.com/photo-1542066681-3129a81d8cab",
    imageAlt: 'Elegant waterfront restaurant with floor-to-ceiling windows overlooking harbor',
    phone: '(555) 123-4568',
    features: ['Ocean View', 'Outdoor Seating', 'Live Music']
  },
  {
    id: 'garden',
    name: 'Pesto Garden',
    address: '789 Green Valley Road, Garden District',
    hours: 'Tue-Sun: 12:00 PM - 9:00 PM',
    capacity: 60,
    image: "https://images.unsplash.com/photo-1507447204628-759dc3244a96",
    imageAlt: 'Charming garden restaurant with outdoor terrace surrounded by lush greenery',
    phone: '(555) 123-4569',
    features: ['Garden Terrace', 'Farm-to-Table', 'Pet Friendly']
  },
  {
    id: 'rooftop',
    name: 'Pesto Rooftop',
    address: '321 Sky Tower, Uptown District',
    hours: 'Wed-Sun: 4:00 PM - 12:00 AM',
    capacity: 95,
    image: "https://images.unsplash.com/photo-1730644285465-1ea941bc5f27",
    imageAlt: 'Stunning rooftop restaurant with city skyline views and modern outdoor dining setup',
    phone: '(555) 123-4570',
    features: ['City Views', 'Rooftop Bar', 'Late Night Dining']
  },
  {
    id: 'suburban',
    name: 'Pesto Suburban',
    address: '654 Oak Hills Boulevard, Westside',
    hours: 'Mon-Sun: 10:00 AM - 9:00 PM',
    capacity: 140,
    image: "https://images.unsplash.com/photo-1673993446533-2e1429bf42dc",
    imageAlt: 'Spacious suburban restaurant with family-friendly atmosphere and comfortable booth seating',
    phone: '(555) 123-4571',
    features: ['Family Friendly', 'Large Groups', 'Playground']
  },
  {
    id: 'historic',
    name: 'Pesto Historic',
    address: '987 Heritage Square, Old Town',
    hours: 'Tue-Sat: 5:00 PM - 10:00 PM',
    capacity: 50,
    image: "https://images.unsplash.com/photo-1640618675149-23fc9c5ff85a",
    imageAlt: 'Intimate historic restaurant in restored brick building with vintage decor and cozy ambiance',
    phone: '(555) 123-4572',
    features: ['Historic Building', 'Intimate Setting', 'Fine Dining']
  }];


  const handleRestaurantSelect = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setCurrentStep(2);
  };

  const handleDateTimeSelect = (date, time) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setCurrentStep(3);
  };

  const handleReservationSubmit = async (formData) => {
    setLoading(true);
    setReservationData(formData);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setLoading(false);
    setShowConfirmation(true);
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    // Reset form or navigate to another page
    setCurrentStep(1);
    setSelectedRestaurant(null);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleCartClick = () => {
    navigate('/shopping-cart');
  };

  const handleAccountClick = (action) => {
    if (action === 'login') navigate('/login');
    if (action === 'register') navigate('/register');
    if (action === 'account') navigate('/user-account');
  };

  const renderStepIndicator = () =>
  <div className="flex items-center justify-center space-x-4 mb-8">
      {[1, 2, 3]?.map((step) =>
    <div key={step} className="flex items-center">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
      step <= currentStep ?
      'bg-primary border-primary text-primary-foreground' :
      'bg-card border-border text-muted-foreground'}`
      }>
            {step < currentStep ?
        <Icon name="Check" size={16} /> :

        <span className="font-body font-medium">{step}</span>
        }
          </div>
          {step < 3 &&
      <div className={`w-16 h-0.5 mx-2 transition-colors duration-200 ${
      step < currentStep ? 'bg-primary' : 'bg-border'}`
      } />
      }
        </div>
    )}
    </div>;


  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <RestaurantSelector
            restaurants={restaurants}
            onSelect={handleRestaurantSelect} />);


      case 2:
        return (
          <DateTimePicker
            restaurant={selectedRestaurant}
            onSelect={handleDateTimeSelect}
            onBack={() => setCurrentStep(1)} />);


      case 3:
        return (
          <ReservationForm
            restaurant={selectedRestaurant}
            date={selectedDate}
            time={selectedTime}
            onSubmit={handleReservationSubmit}
            onBack={() => setCurrentStep(2)}
            loading={loading} />);


      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header
        cartCount={cartCount}
        onCartClick={handleCartClick}
        onAccountClick={handleAccountClick}
        onSearch={() => {}}
        onLogout={() => {}} />


      {/* Main Content */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="bg-primary text-primary-foreground py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl lg:text-5xl font-heading font-bold mb-4">
                Reserve Your Table
              </h1>
              <p className="text-lg lg:text-xl font-body opacity-90 max-w-2xl mx-auto">
                Book your perfect dining experience at Jollys Kafe. Choose your preferred date and time for an unforgettable meal.
              </p>
              {selectedLocation && (
                <div className="mt-4 inline-flex items-center space-x-2 bg-white/20 rounded-full px-4 py-2">
                  <Icon name="MapPin" size={16} />
                  <span className="text-sm font-body font-medium">{selectedLocation?.name}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Reservation Content */}
        <section className="py-8 lg:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Step Content */}
            <div className="bg-card rounded-2xl p-6 lg:p-8 shadow-warm">
              {renderStepContent()}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="bg-muted py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-card rounded-2xl p-8 lg:p-12 shadow-warm">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon name="Calendar" size={24} color="#4C1D0A" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-4">
                Need Help with Your Reservation?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Our team is here to assist you with special requests, large parties, or any questions about your dining experience. Call us directly for personalized service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:+15551234567"
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105">
                  <Icon name="Phone" size={18} />
                  <span>Call (555) 123-4567</span>
                </a>
                <button
                  onClick={() => navigate('/menu-catalog')}
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-accent text-accent-foreground rounded-lg font-body font-medium hover:bg-accent/90 transition-all duration-200 hover:scale-105">
                  <Icon name="Menu" size={18} />
                  <span>View Menu</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="UtensilsCrossed" size={20} color="white" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg">Pesto</h3>
                <p className="text-xs opacity-80 -mt-1">Restaurant</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm opacity-80">
                © {new Date()?.getFullYear()} Jollys Kafe. All rights reserved.
              </p>
              <p className="text-xs opacity-60 mt-1">
                Made with ❤️ for food lovers everywhere
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Confirmation Modal */}
      {showConfirmation &&
      <ConfirmationModal
        restaurant={selectedRestaurant}
        date={selectedDate}
        time={selectedTime}
        reservationData={reservationData}
        onClose={handleConfirmationClose} />

      }
    </div>);

};

export default TableReservation;