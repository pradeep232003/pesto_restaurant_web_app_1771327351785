import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Apple-style "Settings squircle" icon tile.
//
// Each tile is a white card with a colored squircle icon, a title, and an
// optional subtitle. `to` makes it a real link; `comingSoon` shows the badge
// and disables navigation. `badge` shows a small numeric pill (e.g. cooling count).
export const Tile = ({ to, comingSoon, icon: Icon, color, title, subtitle, testId, badge }) => {
  const inner = (
    <div
      data-testid={testId}
      className={`relative h-full flex flex-col rounded-3xl p-5 transition-all duration-200 ${comingSoon ? '' : 'active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md'}`}
      style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div
        className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-3 relative"
        style={{ background: color }}
      >
        <Icon size={22} color="white" strokeWidth={2} />
        {badge != null && Number(badge) > 0 && (
          <span
            data-testid={testId ? `${testId}-badge` : undefined}
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
            style={{ background: '#FF3B30', color: '#FFFFFF', border: '2px solid #FFFFFF', lineHeight: 1 }}
          >{badge}</span>
        )}
      </div>
      <p className="text-[15px] font-semibold leading-tight" style={{ color: '#1D1D1F' }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-[12px] mt-1 leading-snug" style={{ color: '#86868B' }}>
          {subtitle}
        </p>
      )}
      {comingSoon ? (
        <span className="absolute top-4 right-4 text-[9px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}>
          Soon
        </span>
      ) : (
        <ChevronRight size={14} strokeWidth={2.4} className="absolute top-5 right-5" style={{ color: '#C7C7CC' }} />
      )}
    </div>
  );
  if (comingSoon || !to) return inner;
  return <Link to={to} className="block">{inner}</Link>;
};

export const SectionLabel = ({ children }) => (
  <p className="text-[12px] font-semibold tracking-[0.06em] uppercase mt-7 mb-2 px-1"
     style={{ color: '#86868B' }}>{children}</p>
);
