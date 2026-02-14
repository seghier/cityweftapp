import React from 'react';
import { MapPin } from 'lucide-react';

interface LocationOverlayProps {
    locationName: string | null;
}

const LocationOverlay: React.FC<LocationOverlayProps> = ({ locationName }) => {
    if (!locationName) return null;

    return (
        <div className="absolute top-8 right-8 z-[1400] pointer-events-none h-12 flex items-center">
            <div className="glass-panel px-6 py-2 rounded-[20px] flex items-center gap-3 shadow-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md animate-in slide-in-from-top-4 fade-in duration-700">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black text-white uppercase tracking-[0.2em] drop-shadow-md whitespace-nowrap">
                    {locationName}
                </span>
            </div>
        </div>
    );
};

export default LocationOverlay;
