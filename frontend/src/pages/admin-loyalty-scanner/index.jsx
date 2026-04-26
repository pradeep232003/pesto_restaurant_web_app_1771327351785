import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation2 } from '../../contexts/LocationContext';

const AdminLoyaltyScanner = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, loading: authLoading } = useAuth();
  const { locations } = useLocation2();
  const [scanning, setScanning] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [locationId, setLocationId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isStaff)) navigate('/admin-login');
  }, [authLoading, isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  const startScanner = async () => {
    setError('');
    setScannedCustomer(null);
    setResult(null);
    setScanning(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.type === 'jollys_loyalty' && data.cid) {
              stopScanner();
              setScannedCustomer({ id: data.cid });
            } else {
              setError('Invalid QR code');
            }
          } catch {
            setError('Invalid QR code format');
          }
        },
        () => {} // ignore scan failures
      );
    } catch (err) {
      setError('Camera access denied. Please allow camera permission.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear().catch(() => {});
      html5QrRef.current = null;
    }
    setScanning(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scannedCustomer || !amount || !locationId) return;
    setSaving(true); setError('');
    try {
      const res = await api.adminLoyaltyScan({
        customer_id: scannedCustomer.id,
        amount: parseFloat(amount),
        location_id: locationId,
        note,
      });
      setResult(res);
      setAmount(''); setNote('');
    } catch (err) {
      setError(err.message || 'Failed to record');
    } finally { setSaving(false); }
  };

  const resetScan = () => {
    setScannedCustomer(null);
    setResult(null);
    setError('');
    setAmount('');
    setNote('');
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  const font = { fontFamily: 'Outfit, sans-serif' };
  const inputBase = "w-full px-3 py-3 rounded-xl text-sm border-0 outline-none min-w-0";
  const inputStyle = { background: '#F5F5F7', color: '#1D1D1F', ...font, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto" data-testid="admin-loyalty-scanner-page">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: '#1D1D1F', ...font }}>Scan Loyalty Card</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: '#86868B' }}>Scan customer QR code to record spend</p>
      </div>

      {/* Success result */}
      {result && (
        <div className="p-5 rounded-2xl mb-5 text-center" style={{ background: 'rgba(52,199,89,0.08)' }}>
          <Check size={32} className="mx-auto mb-2" style={{ color: '#34C759' }} />
          <p className="text-sm font-semibold" style={{ color: '#34C759', ...font }}>Spend Recorded!</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#1D1D1F', ...font }}>{result.customer_name}</p>
          <p className="text-sm" style={{ color: '#86868B' }}>{'\u00A3'}{result.amount?.toFixed(2)} added</p>
          <div className="mt-3 flex gap-3 justify-center text-xs" style={{ color: '#86868B' }}>
            <span>Total: {'\u00A3'}{result.total_spend?.toFixed(2)}</span>
            <span>Visits: {result.visits}</span>
          </div>
          <button onClick={resetScan} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all"
            style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>Scan Another</button>
        </div>
      )}

      {/* Scanner */}
      {!result && !scannedCustomer && (
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: '#FFFFFF' }}>
          <div id="qr-reader" ref={scannerRef} style={{ width: '100%' }} />
          {!scanning ? (
            <div className="p-6 text-center">
              <ScanLine size={48} className="mx-auto mb-4" style={{ color: '#C7C7CC' }} />
              <button data-testid="start-scan-btn" onClick={startScanner}
                className="px-8 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
                style={{ background: '#1D1D1F', color: '#FFFFFF', ...font }}>
                Open Camera
              </button>
            </div>
          ) : (
            <div className="p-3 text-center">
              <p className="text-xs" style={{ color: '#86868B', ...font }}>Point camera at customer's QR code</p>
              <button onClick={stopScanner} className="mt-2 text-xs font-medium" style={{ color: '#FF3B30' }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Scanned — enter amount */}
      {!result && scannedCustomer && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl mb-5 space-y-4" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}>
              {scannedCustomer.id?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1D1D1F', ...font }}>Customer Scanned</p>
              <p className="text-[11px]" style={{ color: '#86868B' }}>ID: {scannedCustomer.id?.substring(0, 8)}...</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Spend Amount</label>
            <input data-testid="scan-amount" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount}
              onChange={e => setAmount(e.target.value)} required className={inputBase} style={inputStyle} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Location</label>
            <select data-testid="scan-location" value={locationId} onChange={e => setLocationId(e.target.value)} required className={inputBase} style={inputStyle}>
              <option value="">Select location...</option>
              {locations.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#86868B', ...font }}>Note (optional)</label>
            <input type="text" placeholder="e.g. 2x coffee + sandwich" value={note} onChange={e => setNote(e.target.value)} className={inputBase} style={inputStyle} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} data-testid="record-spend-btn"
              className="flex-1 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ background: '#34C759', color: '#FFFFFF', ...font }}>{saving ? 'Recording...' : 'Record Spend'}</button>
            <button type="button" onClick={resetScan}
              className="px-4 py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-all"
              style={{ background: '#F5F5F7', color: '#1D1D1F', ...font }}><X size={16} /></button>
          </div>
        </form>
      )}

      {error && (
        <div className="p-3 rounded-xl text-sm text-center mb-4" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30', ...font }}>{error}</div>
      )}
    </div>
  );
};

export default AdminLoyaltyScanner;
