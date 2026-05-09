import React from 'react';
import { Shield, Package, Trash2, ChefHat, Salad, BarChart3, Sparkles, DollarSign, UtensilsCrossed, FileCheck, ClipboardCheck, FolderOpen, Award } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';
import { useAuth } from '../../contexts/AuthContext';

const Intelligence = () => {
  const { user } = useAuth();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = (user?.name || user?.email || '').split(' ')[0].split('@')[0];

  return (
    <div className="pb-8" data-testid="jkhive-intelligence">
      {/* Hero */}
      <div className="mb-2">
        <p className="text-[13px] font-medium" style={{ color: '#86868B' }}>{greeting}{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
          Intelligence
        </h1>
        <p className="text-[14px] mt-2" style={{ color: '#86868B' }}>
          Your single pane of glass — hygiene, menu, inventory, wastage and more.
        </p>
      </div>

      <SectionLabel>Operate</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          testId="tile-daily-sales"
          to="/jkhive/daily-sales"
          icon={DollarSign}
          color="#FF9500"
          title="Daily Sales"
          subtitle="Record sales & staff hours"
        />
        <Tile
          testId="tile-inventory"
          to="/jkhive/inventory"
          icon={Package}
          color="#FF2D55"
          title="Inventory"
          subtitle="Stock taking & FIFO"
        />
      </div>

      <SectionLabel>Wastage</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          testId="tile-food-wastage"
          comingSoon
          icon={Trash2}
          color="#FF3B30"
          title="Food Wastage"
          subtitle="Track all food loss"
        />
        <Tile
          testId="tile-in-service-wastage"
          comingSoon
          icon={UtensilsCrossed}
          color="#FF2D55"
          title="In-Service Wastage"
          subtitle="During trading hours"
        />
        <Tile
          testId="tile-in-prep-wastage"
          comingSoon
          icon={ChefHat}
          color="#AF52DE"
          title="In-Prep Wastage"
          subtitle="Kitchen prep losses"
        />
      </div>

      <SectionLabel>Compliance & docs</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-hygiene-compliance" to="/jkhive/compliance" icon={Shield}    color="#34C759" title="Hygiene Compliance" subtitle="EHO-ready compliance matrix" />
        <Tile testId="tile-allergens"          comingSoon icon={Salad} color="#30B0C7" title="Allergens"          subtitle="14-allergen matrix" />
        <Tile testId="tile-haccp"              comingSoon icon={FileCheck}      color="#34C759" title="HACCP Plan"     subtitle="Plans & digital signatures" />
        <Tile testId="tile-inspection"         comingSoon icon={ClipboardCheck} color="#FF9500" title="Inspection Mode" subtitle="EHO-ready audit pack" />
        <Tile testId="tile-documents"          comingSoon icon={FolderOpen}     color="#5856D6" title="Documents"      subtitle="Policies & manuals" />
        <Tile testId="tile-risk-assessments"   comingSoon icon={Shield}         color="#FF3B30" title="Risk Assessments" subtitle="HSE-ready records" />
      </div>
    </div>
  );
};

export default Intelligence;
