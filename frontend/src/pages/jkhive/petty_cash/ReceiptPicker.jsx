import React, { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { api, resolveImageUrl } from '../../../lib/api';
import { FONT, shrinkImage } from './shared';

export const ReceiptPicker = ({ value, onChange, onError }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.pettyCashUploadReceipt(await shrinkImage(file));
      onChange(res.image_url);
    } catch (err) {
      onError(err.message || 'Receipt upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div data-testid="petty-receipt-preview" style={{ position: 'relative', width: 72, height: 72 }}>
        <img src={resolveImageUrl(value)} alt="Receipt" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid #ECECEF' }} />
        <button
          data-testid="petty-receipt-remove"
          onClick={() => onChange('')}
          aria-label="Remove receipt"
          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: 0, background: '#1D1D1F', color: '#FFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={pick} hidden data-testid="petty-receipt-input" />
      <button
        data-testid="petty-receipt-btn"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px dashed #C7C7CC', background: '#FFFFFF', color: '#3A3A3C', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...FONT }}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {uploading ? 'Uploading…' : 'Add receipt photo (optional)'}
      </button>
    </>
  );
};
