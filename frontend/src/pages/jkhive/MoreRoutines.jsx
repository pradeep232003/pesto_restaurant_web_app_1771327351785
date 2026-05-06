import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gauge, Thermometer, ShowerHead, FlaskConical, Package, Sparkles, Soup, Droplet, Flame } from 'lucide-react';
import { Tile, SectionLabel } from './Tile';

const MoreRoutines = () => {
  const navigate = useNavigate();
  return (
    <div className="pb-8" data-testid="jkhive-routines-more">
      {/* Header with back chevron */}
      <button
        data-testid="more-routines-back"
        onClick={() => navigate('/jkhive/routines')}
        className="flex items-center gap-1 -ml-2 px-2 py-1 mb-2 rounded-lg text-[13px] font-medium active:scale-95"
        style={{ color: '#007AFF' }}
      >
        <ArrowLeft size={16} strokeWidth={2.4} /> Routines
      </button>
      <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-[1.05]" style={{ color: '#1D1D1F' }}>
        More Routines
      </h1>
      <p className="text-[14px] mt-2 mb-1" style={{ color: '#86868B' }}>
        Specialist checks &amp; HACCP compliance logs.
      </p>

      <SectionLabel>Equipment & calibration</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-probe-cal"        to="/admin/probe-calibration" icon={Gauge}         color="#FF9500" title="Probe Calibration" subtitle="Cold/hot accuracy" />
        <Tile testId="tile-hot-cold-holding" comingSoon                    icon={Thermometer}   color="#FF3B30" title="Hot/Cold Holding"  subtitle="Service-line temps" />
        <Tile testId="tile-washer-temps"     comingSoon                    icon={ShowerHead}    color="#FFCC00" title="Washer Temps"      subtitle="Dishwasher cycle" />
        <Tile testId="tile-food-acidity"     comingSoon                    icon={FlaskConical}  color="#30B0C7" title="Food Acidity"      subtitle="pH testing" />
      </div>

      <SectionLabel>Specialist methods</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-vacuum-packing"   comingSoon                    icon={Package}       color="#007AFF" title="Vacuum Packing"    subtitle="Sealed batches" />
        <Tile testId="tile-food-washing"     comingSoon                    icon={Sparkles}      color="#32ADE6" title="Food Washing"      subtitle="Wash & sanitise" />
        <Tile testId="tile-sous-vide"        comingSoon                    icon={Soup}          color="#AF52DE" title="Sous Vide"         subtitle="Time/temp programs" />
      </div>

      <SectionLabel>Compliance</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Tile testId="tile-legionella"       to="/admin/legionella"        icon={Droplet}       color="#30B0C7" title="Legionella"        subtitle="Weekly water test" />
        <Tile testId="tile-temp-log"         to="/admin/temp-monitor"      icon={Thermometer}   color="#5856D6" title="Temperature Log"   subtitle="Fridge & freezer" />
        <Tile testId="tile-daily-cleaning"   to="/admin/daily-cleaning"    icon={Sparkles}      color="#34C759" title="Daily Cleaning"    subtitle="18 cleaning items" />
        <Tile testId="tile-weekly-cleaning"  to="/admin/weekly-cleaning"   icon={Sparkles}      color="#BF5AF2" title="Weekly Deep Clean" subtitle="Deep clean roster" />
        <Tile testId="tile-cooked-temp-shortcut" to="/admin/cooked-temp"   icon={Flame}         color="#FF2D55" title="Cooked Temp"       subtitle="≥ 75°C compliance" />
      </div>
    </div>
  );
};

export default MoreRoutines;
