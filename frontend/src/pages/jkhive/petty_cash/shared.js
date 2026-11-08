export const FONT = { fontFamily: 'Outfit, sans-serif' };
export const ACCENT = '#34C759';

export const CATEGORY_COLOURS = {
  'Milk & Dairy': '#0A84FF',
  'Food & Groceries': '#FF9500',
  Cleaning: '#30B0C7',
  Supplies: '#AF52DE',
  Maintenance: '#FF3B30',
  Travel: '#5856D6',
  Other: '#8E8E93',
};

export const gbp = (n) => `£${Number(n || 0).toFixed(2)}`;

export const isoDay = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

export const presetRange = (key) => {
  const today = new Date();
  const to = isoDay(today);
  if (key === 'today') return { from: to, to };
  if (key === '7d') { const f = new Date(today); f.setDate(f.getDate() - 6); return { from: isoDay(f), to }; }
  if (key === 'month') return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (key === 'last-month') {
    return {
      from: isoDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: isoDay(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  return { from: '', to: '' };
};

export const fieldStyle = {
  border: '1px solid #ECECEF', background: '#F5F5F7', borderRadius: 10,
  padding: '10px 12px', fontSize: 14, color: '#1D1D1F', outline: 'none',
  width: '100%', boxSizing: 'border-box', ...FONT,
};

export const cardStyle = {
  background: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export const labelStyle = {
  margin: '0 0 8px', fontSize: 12, color: '#86868B', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

// Downscale large phone photos before upload so receipts stay small.
export const shrinkImage = (file, max = 1600) => new Promise((resolve) => {
  if (!file.type.startsWith('image/') || file.type.includes('heic') || file.type.includes('heif')) return resolve(file);
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(url);
      resolve(blob ? new File([blob], 'receipt.jpg', { type: 'image/jpeg' }) : file);
    }, 'image/jpeg', 0.8);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});
