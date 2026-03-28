import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { resolveImageUrl } from '../../../lib/api';

const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto'];

const ImageUploadField = ({ currentUrl, onFileSelect, selectedFile }) => {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [selectedFile]);

  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        data-testid="modal-image-file-input"
        className="hidden"
        onChange={(e) => {
          const file = e?.target?.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
          {displayUrl ? (
            <img src={displayUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Icon name="ImagePlus" size={24} color="var(--color-muted-foreground)" />
          )}
        </div>
        {/* Actions */}
        <div className="flex-1 space-y-2">
          <button
            type="button"
            data-testid="upload-image-from-pc-btn"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body font-medium hover:bg-muted hover:border-primary/40 transition-all"
          >
            <Icon name="Upload" size={14} />
            {selectedFile ? 'Change Image' : 'Upload from PC'}
          </button>
          {selectedFile && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
            </p>
          )}
          {!selectedFile && currentUrl && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Icon name="CheckCircle" size={10} />
              Image uploaded
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminMenuItemModal = ({ item, categories, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    name: '',
    subtitle: '',
    description: '',
    price: '',
    visitorPrice: '',
    originalPrice: '',
    imageUrl: '',
    imageAlt: '',
    imageFile: null,
    categories: [],
    dietary: [],
    tags: '',
    featured: false,
    prepTime: '15',
    isAvailable: true,
    showImage: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (item) {
      setForm({
        name: item?.name || '',
        subtitle: item?.subtitle || '',
        description: item?.description || '',
        price: item?.price ? String(item?.price) : '',
        visitorPrice: item?.visitor_price ? String(item?.visitor_price) : '',
        originalPrice: item?.original_price ? String(item?.original_price) : '',
        imageUrl: item?.image_url || '',
        imageAlt: item?.image_alt || '',
        categories: item?.categories?.length > 0 ? item?.categories : (item?.category ? [item?.category] : []),
        dietary: item?.dietary || [],
        tags: item?.tags?.join(', ') || '',
        featured: item?.featured || false,
        prepTime: item?.prep_time ? String(item?.prep_time) : '15',
        isAvailable: item?.is_available !== false,
        showImage: item?.show_image !== false,
      });
    }
  }, [item]);

  const validate = () => {
    const errs = {};
    if (!form?.name?.trim()) errs.name = 'Name is required';
    if (!form?.price || isNaN(parseFloat(form?.price))) errs.price = 'Valid price is required';
    if (form?.categories?.length === 0) errs.categories = 'Select at least one category';
    setErrors(errs);
    return Object.keys(errs)?.length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      tags: form?.tags?.split(',')?.map(t => t?.trim())?.filter(Boolean),
      showImage: form?.showImage,
      imageFile: form?.imageFile,
    });
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleCategory = (catId) => {
    setForm(prev => ({
      ...prev,
      categories: prev?.categories?.includes(catId)
        ? prev?.categories?.filter(c => c !== catId)
        : [...prev?.categories, catId]
    }));
    if (errors?.categories) setErrors(prev => ({ ...prev, categories: '' }));
  };

  const toggleDietary = (diet) => {
    setForm(prev => ({
      ...prev,
      dietary: prev?.dietary?.includes(diet)
        ? prev?.dietary?.filter(d => d !== diet)
        : [...prev?.dietary, diet]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={onClose}></div>
      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-heading font-bold text-foreground">
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
              Item Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form?.name}
              onChange={(e) => handleChange('name', e?.target?.value)}
              placeholder="e.g. Full English Breakfast"
              className={`w-full px-4 py-2.5 rounded-lg border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200 ${errors?.name ? 'border-destructive' : 'border-border'}`}
            />
            {errors?.name && <p className="text-xs text-destructive mt-1">{errors?.name}</p>}
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Subtitle</label>
            <input
              type="text"
              value={form?.subtitle}
              onChange={(e) => handleChange('subtitle', e?.target?.value)}
              placeholder="e.g. With toast and beans"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Description</label>
            <textarea
              value={form?.description}
              onChange={(e) => handleChange('description', e?.target?.value)}
              placeholder="Describe the dish..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200 resize-none"
            />
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
                Resident Price (R) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">{'\u00A3'}</span>
                <input
                  data-testid="resident-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form?.price}
                  onChange={(e) => handleChange('price', e?.target?.value)}
                  placeholder="0.00"
                  className={`w-full pl-7 pr-4 py-2.5 rounded-lg border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200 ${errors?.price ? 'border-destructive' : 'border-border'}`}
                />
              </div>
              {errors?.price && <p className="text-xs text-destructive mt-1">{errors?.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-body font-semibold text-foreground mb-1.5">
                Visitor Price (V)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">{'\u00A3'}</span>
                <input
                  data-testid="visitor-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form?.visitorPrice}
                  onChange={(e) => handleChange('visitorPrice', e?.target?.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Original Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">{'\u00A3'}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form?.originalPrice}
                  onChange={(e) => handleChange('originalPrice', e?.target?.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
                />
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Food Image</label>
            <ImageUploadField
              currentUrl={resolveImageUrl(form?.imageUrl)}
              onFileSelect={(file) => handleChange('imageFile', file)}
              selectedFile={form?.imageFile}
            />
          </div>

          {/* Image Alt */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Image Description (Alt Text)</label>
            <input
              type="text"
              value={form?.imageAlt}
              onChange={(e) => handleChange('imageAlt', e?.target?.value)}
              placeholder="Describe the image for accessibility"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-2">
              Categories <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground font-normal ml-1">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {categories?.map(cat => (
                <button
                  key={cat?.id}
                  type="button"
                  onClick={() => toggleCategory(cat?.id)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 border ${
                    form?.categories?.includes(cat?.id)
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <Icon name={cat?.icon} size={14} />
                  <span>{cat?.name}</span>
                  {form?.categories?.includes(cat?.id) && <Icon name="Check" size={12} />}
                </button>
              ))}
            </div>
            {errors?.categories && <p className="text-xs text-destructive mt-1">{errors?.categories}</p>}
          </div>

          {/* Dietary */}
          <div>
            <label className="block text-sm font-body font-semibold text-foreground mb-2">Dietary Options</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS?.map(diet => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => toggleDietary(diet)}
                  className={`px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all duration-200 border capitalize ${
                    form?.dietary?.includes(diet)
                      ? 'bg-green-100 text-green-700 border-green-300' :'bg-background text-foreground border-border hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  {diet}
                </button>
              ))}
            </div>
          </div>

          {/* Tags & Prep Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Tags (comma-separated)</label>
              <input
                type="text"
                value={form?.tags}
                onChange={(e) => handleChange('tags', e?.target?.value)}
                placeholder="e.g. spicy, popular, seasonal"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-body font-semibold text-foreground mb-1.5">Prep Time (mins)</label>
              <input
                type="number"
                min="1"
                value={form?.prepTime}
                onChange={(e) => handleChange('prepTime', e?.target?.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <div
                onClick={() => handleChange('featured', !form?.featured)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${form?.featured ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form?.featured ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
              </div>
              <span className="text-sm font-body text-foreground">Featured item</span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <div
                onClick={() => handleChange('isAvailable', !form?.isAvailable)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${form?.isAvailable ? 'bg-green-500' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form?.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
              </div>
              <span className="text-sm font-body text-foreground">Available</span>
            </label>
            <label className="flex items-center space-x-2.5 cursor-pointer" data-testid="show-image-toggle">
              <div
                onClick={() => handleChange('showImage', !form?.showImage)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${form?.showImage ? 'bg-blue-500' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form?.showImage ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
              </div>
              <span className="text-sm font-body text-foreground">Show image on menu</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-border text-foreground font-body font-medium hover:bg-muted transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-body font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>}
              <span>{saving ? 'Saving...' : (item ? 'Update Item' : 'Add Item')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminMenuItemModal;
