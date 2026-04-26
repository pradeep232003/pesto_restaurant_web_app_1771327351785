import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Download } from 'lucide-react';
import api from '../../lib/api';
import { useCustomer } from '../../contexts/CustomerContext';
import Header from '../../components/ui/Header';

const LoyaltyCard = () => {
  const navigate = useNavigate();
  const { customer, loading: custLoading } = useCustomer();
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!custLoading && !customer) navigate('/customer-auth');
  }, [custLoading, customer, navigate]);

  useEffect(() => {
    if (customer) fetchCard();
  }, [customer]);

  const fetchCard = async () => {
    try {
      const d = await api.getMyLoyaltyCard();
      setCardData(d);
    } catch (err) {
      console.error('Failed to load loyalty card:', err);
    } finally { setLoading(false); }
  };

  const handleSaveImage = () => {
    if (!cardData?.qr_image) return;
    const link = document.createElement('a');
    link.href = cardData.qr_image;
    link.download = `jollys-loyalty-card.png`;
    link.click();
  };

  const font = { fontFamily: 'Outfit, sans-serif' };

  return (
    <div className="min-h-screen" style={{ background: '#FBFBFD' }}>
      <Header onCartClick={() => navigate('/shopping-cart')} onSearch={() => {}} onLogout={() => {}} />

      <main className="pt-20 pb-12 px-4 max-w-md mx-auto">
        {loading || custLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : !cardData ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: '#86868B', ...font }}>Unable to load your loyalty card.</p>
          </div>
        ) : (
          <div data-testid="loyalty-card-page">
            {/* Card */}
            <div className="rounded-3xl overflow-hidden" style={{ background: '#1D1D1F', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {/* Top section */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Loyalty Card</p>
                  <CreditCard size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>
                <h2 className="text-xl font-bold text-white" style={font}>Jolly's Kafe</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)', ...font }}>{cardData.customer_name}</p>
              </div>

              {/* QR section */}
              <div className="flex justify-center py-5 mx-6 rounded-2xl" style={{ background: '#FFFFFF' }}>
                <img
                  data-testid="loyalty-qr-image"
                  src={cardData.qr_image}
                  alt="Loyalty QR Code"
                  className="w-48 h-48"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              {/* Bottom */}
              <div className="px-6 py-4 text-center">
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)', ...font }}>Show this code when you order</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <button
                data-testid="save-card-btn"
                onClick={handleSaveImage}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
                style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}
              >
                <Download size={16} /> Save QR Code
              </button>

              <p className="text-center text-xs" style={{ color: '#86868B', ...font }}>
                Save the QR code to your photos for quick access
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LoyaltyCard;
