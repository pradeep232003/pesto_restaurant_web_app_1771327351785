import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import api, { resolveImageUrl } from '../../../lib/api';

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

/**
 * Spec-sheet photo uploader (max 4). Uploads on-pick so the persisted
 * URL is stable across form saves; the parent only tracks the array.
 * `itemId` is null when creating a fresh item — in that case the upload
 * button is disabled with a helpful hint (save the item first, then
 * come back to add photos).
 */
const SpecPhotos = ({ itemId, urls, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handlePick = async (file) => {
    if (!file || !itemId) return;
    setErr('');
    setUploading(true);
    try {
      const res = await api.adminUploadSpecPhoto(itemId, file);
      if (res?.photo_urls) onChange(res.photo_urls);
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (u) => {
    if (!itemId) { onChange((urls || []).filter(x => x !== u)); return; }
    setErr('');
    try {
      const res = await api.adminDeleteSpecPhoto(itemId, u);
      if (res?.photo_urls) onChange(res.photo_urls);
    } catch (e) {
      setErr(e.message || 'Remove failed');
    }
  };

  const canAdd = (urls || []).length < 4;
  const disabled = !itemId || !canAdd || uploading;

  return (
    <div data-testid="spec-photos">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference photos <span className="normal-case font-normal">({(urls || []).length}/4)</span></span>
        <button
          type="button"
          data-testid="spec-photo-add-btn"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all disabled:opacity-50"
          title={!itemId ? 'Save the item first to attach photos' : ''}
        >
          <Icon name={uploading ? 'Loader2' : 'ImagePlus'} size={12} />
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePick(e?.target?.files?.[0])}
      />
      {!itemId && (
        <p className="text-[11px] text-muted-foreground italic mb-2">
          Save the item once, then reopen to attach reference photos for staff.
        </p>
      )}
      {err && <p className="text-xs text-destructive mb-2">{err}</p>}
      {(urls || []).length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          No photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {(urls || []).map((u) => (
            <div key={u} className="relative rounded-lg overflow-hidden border border-border bg-muted/40 aspect-square group">
              <img src={resolveImageUrl(u)} alt="Spec" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(u)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                title="Remove"
                data-testid={`spec-photo-remove-${u}`}
              >
                <Icon name="X" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Prep-technique video — accepts either a direct upload (mp4/webm/mov,
 * capped at 25 MB by the backend) or a pasted external URL (YouTube,
 * Vimeo, Loom, direct .mp4). One video per dish; uploading a new one
 * replaces the previous. URL edits persist on save with the item.
 */
const SpecVideo = ({ itemId, url, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handlePick = async (file) => {
    if (!file || !itemId) return;
    setErr('');
    setUploading(true);
    try {
      const res = await api.adminUploadSpecVideo(itemId, file);
      if (res?.video_url) onChange(res.video_url);
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!itemId) { onChange(''); return; }
    setErr('');
    try {
      // Only call the backend when it's an uploaded video — pasted URLs
      // are cleared client-side and persisted on save.
      if ((url || '').startsWith('/api/images/')) {
        await api.adminDeleteSpecVideo(itemId);
      }
      onChange('');
    } catch (e) {
      setErr(e.message || 'Remove failed');
    }
  };

  const disabled = !itemId || uploading;

  return (
    <div className="mt-4" data-testid="spec-video">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Prep video <span className="normal-case font-normal">(one per dish)</span>
        </span>
        <div className="flex items-center gap-2">
          {url && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-all"
              data-testid="spec-video-clear"
            >
              <Icon name="Trash2" size={11} /> Remove
            </button>
          )}
          <button
            type="button"
            data-testid="spec-video-upload"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all disabled:opacity-50"
            title={!itemId ? 'Save the item first to attach a video' : ''}
          >
            <Icon name={uploading ? 'Loader2' : 'Video'} size={12} />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => handlePick(e?.target?.files?.[0])}
      />
      {!itemId && (
        <p className="text-[11px] text-muted-foreground italic mb-2">
          Save the item first to upload a video (external URLs can be pasted below).
        </p>
      )}
      <input
        type="text"
        value={url || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a YouTube, Vimeo or Loom URL — or leave blank and upload above"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        data-testid="spec-video-url"
      />
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
      {url && !url.startsWith('/api/images/') && !/youtu|vimeo|loom/i.test(url) && (
        <p className="text-[11px] text-muted-foreground italic mt-1">
          Not a known video host — the viewer will attempt a generic HTML5 player.
        </p>
      )}
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
    recipe: [],
    spec: { prep_steps: [], plating_notes: '', temps: '', times: '', portion: '', garnish: '', photo_urls: [], video_url: '' },
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
        recipe: (item?.recipe || []).map(r => ({
          ingredient: r?.ingredient || '',
          qty: r?.qty != null ? String(r.qty) : '',
          unit: r?.unit || '',
          unit_cost: r?.unit_cost != null ? String(r.unit_cost) : '',
        })),
        spec: {
          prep_steps: Array.isArray(item?.spec?.prep_steps) ? [...item.spec.prep_steps] : [],
          plating_notes: item?.spec?.plating_notes || '',
          temps: item?.spec?.temps || '',
          times: item?.spec?.times || '',
          portion: item?.spec?.portion || '',
          garnish: item?.spec?.garnish || '',
          photo_urls: Array.isArray(item?.spec?.photo_urls) ? [...item.spec.photo_urls] : [],
          video_url: item?.spec?.video_url || '',
        },
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
      recipe: (form?.recipe || [])
        .map(r => ({
          ingredient: (r?.ingredient || '').trim(),
          qty: parseFloat(r?.qty) || 0,
          unit: (r?.unit || '').trim(),
          unit_cost: parseFloat(r?.unit_cost) || 0,
        }))
        .filter(r => r.ingredient),
      spec: {
        prep_steps: (form?.spec?.prep_steps || []).map(s => (s || '').trim()).filter(Boolean),
        plating_notes: (form?.spec?.plating_notes || '').trim(),
        temps: (form?.spec?.temps || '').trim(),
        times: (form?.spec?.times || '').trim(),
        portion: (form?.spec?.portion || '').trim(),
        garnish: (form?.spec?.garnish || '').trim(),
        photo_urls: Array.isArray(form?.spec?.photo_urls) ? form.spec.photo_urls : [],
        video_url: (form?.spec?.video_url || '').trim(),
      },
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

          {/* Tags Row */}
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

          {/* Recipe (ingredients) */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-body font-semibold text-foreground">Recipe (ingredients & cost)</label>
                <p className="text-xs text-muted-foreground mt-0.5">Used to calculate Food Cost % in Business Intelligence.</p>
              </div>
              <button
                type="button"
                data-testid="recipe-add-line-btn"
                onClick={() => setForm(prev => ({
                  ...prev,
                  recipe: [...(prev?.recipe || []), { ingredient: '', qty: '', unit: 'g', unit_cost: '' }],
                }))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all"
              >
                <Icon name="Plus" size={12} /> Add ingredient
              </button>
            </div>

            {(form?.recipe?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center bg-muted/40 rounded-lg">No ingredients yet — Food Cost % will be 0 for this item.</p>
            ) : (
              <div className="space-y-2">
                {form.recipe.map((line, idx) => {
                  const lineCost = (parseFloat(line.qty) || 0) * (parseFloat(line.unit_cost) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`recipe-line-${idx}`}>
                      <input
                        type="text"
                        placeholder="Ingredient"
                        value={line.ingredient}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          recipe: prev.recipe.map((r, i) => i === idx ? { ...r, ingredient: e.target.value } : r),
                        }))}
                        className="col-span-4 px-2 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid={`recipe-ingredient-${idx}`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          recipe: prev.recipe.map((r, i) => i === idx ? { ...r, qty: e.target.value } : r),
                        }))}
                        className="col-span-2 px-2 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid={`recipe-qty-${idx}`}
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={line.unit}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          recipe: prev.recipe.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r),
                        }))}
                        className="col-span-2 px-2 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid={`recipe-unit-${idx}`}
                      />
                      <div className="col-span-3 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£/u</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.unit_cost}
                          onChange={(e) => setForm(prev => ({
                            ...prev,
                            recipe: prev.recipe.map((r, i) => i === idx ? { ...r, unit_cost: e.target.value } : r),
                          }))}
                          className="w-full pl-8 pr-2 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          data-testid={`recipe-unitcost-${idx}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          recipe: prev.recipe.filter((_, i) => i !== idx),
                        }))}
                        className="col-span-1 inline-flex justify-center items-center w-9 h-9 rounded-lg text-destructive hover:bg-destructive/10 transition-all"
                        data-testid={`recipe-remove-${idx}`}
                        title="Remove ingredient"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                      <div className="col-span-12 text-right text-[11px] text-muted-foreground -mt-1 pr-12">
                        Line cost: £{lineCost.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const totalCost = (form.recipe || []).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unit_cost) || 0), 0);
                  const price = parseFloat(form.price) || 0;
                  const fcPct = price > 0 ? (totalCost / price) * 100 : 0;
                  return (
                    <div className="flex items-center justify-between bg-muted/40 px-3 py-2.5 rounded-lg" data-testid="recipe-summary">
                      <span className="text-xs font-semibold text-foreground">Total recipe cost</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-bold text-foreground">£{totalCost.toFixed(2)}</span>
                        {price > 0 && (
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${fcPct > 35 ? 'bg-red-100 text-red-700' : fcPct > 25 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            FC {fcPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Spec Sheet — Recipe & prep workflow followed by kitchen staff.
              Ordered prep steps, plating notes, key temps/times, portion,
              garnish and up to 4 reference photos. Allergen callouts are
              auto-derived from the item's allergen matrix, not typed here. */}
          <div className="border-t border-border pt-5" data-testid="spec-section">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-body font-semibold text-foreground">Spec Sheet (prep & plating)</label>
                <p className="text-xs text-muted-foreground mt-0.5">Kitchen workflow — every station follows this at the pass.</p>
              </div>
            </div>

            {/* Prep steps — ordered list. */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prep steps</span>
                <button
                  type="button"
                  data-testid="spec-add-step-btn"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    spec: { ...(prev.spec || {}), prep_steps: [...(prev.spec?.prep_steps || []), ''] },
                  }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-all"
                >
                  <Icon name="Plus" size={12} /> Add step
                </button>
              </div>
              {(form?.spec?.prep_steps?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center bg-muted/40 rounded-lg">No steps yet — staff will only see plating notes.</p>
              ) : (
                <div className="space-y-2">
                  {form.spec.prep_steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2" data-testid={`spec-step-${idx}`}>
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0 mt-1">
                        {idx + 1}
                      </div>
                      <textarea
                        value={step}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          spec: {
                            ...(prev.spec || {}),
                            prep_steps: (prev.spec?.prep_steps || []).map((s, i) => i === idx ? e.target.value : s),
                          },
                        }))}
                        placeholder="e.g. Heat the pan to 180°C and add 15g of butter"
                        rows={2}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        data-testid={`spec-step-input-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          spec: {
                            ...(prev.spec || {}),
                            prep_steps: (prev.spec?.prep_steps || []).filter((_, i) => i !== idx),
                          },
                        }))}
                        className="w-9 h-9 rounded-lg text-destructive hover:bg-destructive/10 transition-all flex items-center justify-center flex-shrink-0 mt-0.5"
                        data-testid={`spec-step-remove-${idx}`}
                        title="Remove step"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grid of short spec fields. */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { key: 'temps', label: 'Key temps', placeholder: 'Fry 180°C · Core 75°C' },
                { key: 'times', label: 'Cook times', placeholder: '4 min sear · 8 min oven' },
                { key: 'portion', label: 'Portion size', placeholder: '220g cooked / 1 bowl' },
                { key: 'garnish', label: 'Garnish', placeholder: 'Chopped parsley + lemon wedge' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={form?.spec?.[f.key] || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, spec: { ...(prev.spec || {}), [f.key]: e.target.value } }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid={`spec-${f.key}`}
                  />
                </div>
              ))}
            </div>

            {/* Plating notes — free text. */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Plating notes</label>
              <textarea
                value={form?.spec?.plating_notes || ''}
                onChange={(e) => setForm(prev => ({ ...prev, spec: { ...(prev.spec || {}), plating_notes: e.target.value } }))}
                placeholder="Warm bowl. Sauce base, then noodles nested with tongs, protein on top, garnish last."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-vertical"
                data-testid="spec-plating"
              />
            </div>

            {/* Photo uploader — up to 4. Uploads immediately so the URL
                is stable on save (matches the existing menu-image flow). */}
            <SpecPhotos
              itemId={item?.id}
              urls={form?.spec?.photo_urls || []}
              onChange={(urls) => setForm(prev => ({ ...prev, spec: { ...(prev.spec || {}), photo_urls: urls } }))}
            />

            {/* Prep video — one per dish. Accepts a direct upload (mp4/webm/mov)
                or an external URL (YouTube, Loom, Vimeo). */}
            <SpecVideo
              itemId={item?.id}
              url={form?.spec?.video_url || ''}
              onChange={(url) => setForm(prev => ({ ...prev, spec: { ...(prev.spec || {}), video_url: url } }))}
            />
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
