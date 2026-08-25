import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import api, { resolveImageUrl } from '../../../lib/api';

/**
 * Read-only recipe & spec sheet. Shown to staff via the "View spec"
 * button in the menu table. Pulls allergen labels from the catalog so
 * the callout section stays in sync with the 14-FSA matrix without
 * duplicating strings on every dish.
 */
const MenuItemSpecViewer = ({ item, onClose }) => {
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.allergensCatalog()
      .then(c => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalog(null); });
    return () => { cancelled = true; };
  }, []);

  if (!item) return null;
  const spec = item.spec || {};
  const steps = Array.isArray(spec.prep_steps) ? spec.prep_steps : [];
  const photos = Array.isArray(spec.photo_urls) ? spec.photo_urls : [];
  const allergens = item.allergens || {};
  const mayContain = Array.isArray(item.may_contain) ? item.may_contain : [];

  // Resolve allergen ids → labels from the shared catalog. Present as a
  // flat list of "category" labels because staff only need the top-level
  // callout at the pass; the drawer on the admin allergens page keeps
  // the per-sub-item nuance.
  const catById = new Map();
  for (const c of (catalog?.categories || [])) catById.set(c.id, c);
  const contains = Object.keys(allergens || {}).filter(id => (allergens[id] || []).length > 0);

  return (
    <div className="fixed inset-0 z-[80]" data-testid="spec-viewer">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 top-0 bottom-0 sm:top-6 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-3xl sm:rounded-2xl overflow-hidden bg-white flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Recipe & Spec</p>
            <h2 className="text-xl font-heading font-bold text-foreground truncate">{item.name}</h2>
            {item.subtitle && <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            data-testid="spec-viewer-close"
            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70 transition"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6" style={{ paddingBottom: 40 }}>
          {/* Photos row */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="spec-viewer-photos">
              {photos.map(u => (
                <div key={u} className="aspect-square rounded-lg overflow-hidden border border-border bg-muted/40">
                  <img src={resolveImageUrl(u)} alt="Spec reference" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Quick-facts strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {[
              { label: 'Temps', value: spec.temps, icon: 'Thermometer' },
              { label: 'Times', value: spec.times, icon: 'Clock' },
              { label: 'Portion', value: spec.portion, icon: 'Utensils' },
              { label: 'Garnish', value: spec.garnish, icon: 'Sparkles' },
            ].map(f => (
              <div key={f.label} className="rounded-lg p-3 border border-border bg-muted/30">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  <Icon name={f.icon} size={11} /> {f.label}
                </div>
                <div className="text-sm text-foreground break-words">
                  {f.value || <span className="text-muted-foreground italic">—</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Allergen callout — auto-pulled from the allergen matrix. */}
          {(contains.length > 0 || mayContain.length > 0) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4" data-testid="spec-viewer-allergens">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold mb-2">
                <Icon name="AlertTriangle" size={14} /> Allergen callouts
              </div>
              {contains.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 mb-1">Contains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contains.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-900">
                        {catById.get(id)?.label || id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {mayContain.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 mb-1">May contain</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mayContain.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-white text-amber-900 border border-amber-300">
                        {catById.get(id)?.label || id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prep steps */}
          <div>
            <h3 className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="ListChecks" size={14} /> Prep steps
            </h3>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No prep steps recorded yet.</p>
            ) : (
              <ol className="space-y-2" data-testid="spec-viewer-steps">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{s}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Plating notes */}
          {spec.plating_notes && (
            <div>
              <h3 className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Icon name="Palette" size={14} /> Plating notes
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 rounded-lg p-3" data-testid="spec-viewer-plating">
                {spec.plating_notes}
              </p>
            </div>
          )}

          {/* Recipe ingredients (read-only mirror of admin editor) */}
          {Array.isArray(item.recipe) && item.recipe.length > 0 && (
            <div>
              <h3 className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Icon name="ClipboardList" size={14} /> Ingredients
              </h3>
              <div className="rounded-lg border border-border overflow-hidden" data-testid="spec-viewer-recipe">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ingredient</th>
                      <th className="text-right px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Qty</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.recipe.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{r.ingredient}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {steps.length === 0 && !spec.plating_notes && !spec.temps && !spec.times && !spec.portion && !spec.garnish && photos.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Icon name="BookOpen" size={22} color="var(--color-muted-foreground)" />
              </div>
              <p className="text-sm text-muted-foreground">No spec sheet yet — an admin can add one from the item&apos;s edit drawer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuItemSpecViewer;
