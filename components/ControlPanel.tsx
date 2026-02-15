import React, { useState } from 'react';
import {
  Settings2,
  Download,
  Layers,
  Box,
  Monitor,
  AlertCircle,
  CheckCircle2,
  FileText,
  Cpu,
  Zap,
  HardDrive,
  FileCode,
  ChevronDown,
  Trash2,
  Key,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { AppSettings, ExportFormat, AppStatus, GeometryType } from '../types';

interface ControlPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  exportConfig: { format: ExportFormat; version: number | null; filename: string };
  setExportConfig: React.Dispatch<React.SetStateAction<{ format: ExportFormat; version: number | null; filename: string }>>;
  status: AppStatus;
  progress: number;
  errorMessage: string | null;
  onDownload: () => void;
  onPreview: () => void;
  selectedArea: number;
  onClearSelection: () => void;
  canDownload: boolean;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
  onFileUpload: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  setSettings,
  exportConfig,
  setExportConfig,
  status,
  progress,
  errorMessage,
  onDownload,
  onPreview,
  selectedArea,
  onClearSelection,
  canDownload,
  onOpenApiKeyModal,
  hasApiKey,
  onFileUpload
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'engine' | 'output'>('layers');

  const geometryOptions: { id: GeometryType; label: string; icon: any; desc: string }[] = [
    { id: 'buildings', label: 'Buildings', icon: Box, desc: '3D LOD2 geometry with roofs' },
    { id: 'surface', label: 'Land Surface', icon: Layers, desc: 'Roads, terrain, and landuse' },
    { id: 'infrastructure', label: 'Infrastructure', icon: Cpu, desc: 'Street assets and utility lines' },
    { id: 'barriers', label: 'Barriers', icon: Monitor, desc: 'Fences, walls, and boundaries' },
    { id: 'topography', label: 'Topography', icon: Zap, desc: 'High-res terrain contours' },
  ];

  const formats: { id: ExportFormat; label: string; icon: any }[] = [
    { id: 'skp', label: 'SketchUp (.skp)', icon: HardDrive },
    { id: 'rhino', label: 'Rhino (.3dm)', icon: Zap },
    { id: 'obj', label: 'Wavefront (.obj)', icon: FileCode },
    { id: 'glb', label: 'glTF (.glb)', icon: Monitor },
    { id: 'dxf', label: 'AutoCAD (.dxf)', icon: FileText },
    { id: 'stl', label: 'STL (.stl)', icon: Box },
  ];

  const toggleGeometry = (id: GeometryType) => {
    setSettings(prev => ({
      ...prev,
      geometry: prev.geometry.includes(id) ? prev.geometry.filter(g => g !== id) : [...prev.geometry, id],
      topographyModel: id === 'topography' ? !prev.topographyModel : prev.topographyModel
    }));
  };

  const isDownloading = [AppStatus.PREPARING, AppStatus.REQUESTING, AppStatus.PROCESSING, AppStatus.DOWNLOADING].includes(status);

  return (
    <div className="w-[440px] h-[calc(100%-116px)] mt-[84px] mb-8 ml-8 relative z-[1100] flex flex-col pointer-events-none">
      <div className="glass-panel h-full rounded-[48px] overflow-hidden flex flex-col shadow-2xl pointer-events-auto border border-white/10">

        {/* Connection Status Header */}
        <div className="px-10 pt-10 pb-6 border-b border-white/5">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onOpenApiKeyModal}
              className={`group flex items-center justify-center gap-3 py-4 rounded-[24px] border transition-all duration-300 ${hasApiKey
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)] animate-pulse hover:bg-rose-500/20'
                }`}
            >
              <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">API Keys</span>
            </button>

            <button
              onClick={onFileUpload}
              className="group flex items-center justify-center gap-3 py-4 rounded-[24px] border border-blue-600/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:border-blue-600/50 hover:text-blue-300 transition-all shadow-[0_0_15px_rgba(37,99,235,0.1)] hover:shadow-[0_0_25px_rgba(37,99,235,0.2)]"
            >
              <HardDrive className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Load File</span>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex px-10 pt-4 gap-10 border-b border-white/5">
          {[
            { id: 'layers', label: 'Layers', icon: Layers },
            { id: 'engine', label: 'Engine', icon: Settings2 },
            { id: 'output', label: 'Output', icon: HardDrive }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-5 flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-500' : 'text-slate-500'}`} />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full shadow-lg shadow-blue-500/50" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto px-10 py-10 space-y-8 scroll-smooth">
          {activeTab === 'layers' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">



              {geometryOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => toggleGeometry(opt.id)}
                  className={`w-full group flex items-center justify-start gap-5 p-6 rounded-[32px] border transition-all duration-300 ${settings.geometry.includes(opt.id)
                    ? 'bg-blue-600/10 border-blue-600/40 ring-1 ring-blue-600/20'
                    : 'bg-slate-900/30 border-white/5 hover:bg-slate-900/50'
                    }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${settings.geometry.includes(opt.id) ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                    <opt.icon className="w-7 h-7" />
                  </div>
                  <div className="text-left flex-grow pt-1">
                    <p className={`text-sm font-black mb-1 uppercase tracking-widest ${settings.geometry.includes(opt.id) ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                    <p className={`text-[10px] font-bold leading-relaxed ${settings.geometry.includes(opt.id) ? 'text-blue-200/70' : 'text-slate-500'}`}>{opt.desc}</p>
                  </div>
                  <div className={`mt-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${settings.geometry.includes(opt.id) ? 'bg-blue-600 border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'border-slate-700'}`}>
                    {settings.geometry.includes(opt.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">


              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] px-2">Processing</h4>
                <div className="space-y-3">
                  {[
                    { key: 'cropScene', label: 'Crop Scene', desc: 'Trim excess geometry' },
                    { key: 'disableSurfaceProjection', label: 'Disable Surface Projection', desc: 'Skip terrain mapping' }
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center justify-between p-5 rounded-2xl bg-slate-900/30 border border-white/5 hover:bg-slate-900/50 transition-all cursor-pointer group">
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest">{label}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">{desc}</p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={settings[key as keyof AppSettings] as boolean}
                          onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-slate-800 peer-focus:ring-2 peer-focus:ring-blue-600/30 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] px-2">Roof Archetype</h4>
                <div className="relative group">
                  <select
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-5 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 appearance-none cursor-pointer hover:bg-slate-800 transition-all uppercase tracking-widest"
                    value={settings.defaultRoofType}
                    onChange={(e) => setSettings(prev => ({ ...prev, defaultRoofType: e.target.value }))}
                  >
                    <option value="flat">Flat</option>
                    <option value="hipped">Hipped</option>
                    <option value="gabled">Gabled</option>
                    <option value="gambrel">Gambrel</option>
                    <option value="pyramidal">Pyramidal</option>
                    <option value="onion">Onion</option>
                    <option value="dome">Dome</option>
                    <option value="round">Round</option>
                    <option value="skillion">Skillion</option>
                    <option value="mansard">Mansard</option>
                    <option value="quadrupleSaltbox">Quadruple Saltbox</option>
                    <option value="saltbox">Saltbox</option>
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 w-5 h-5 transition-colors" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'output' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                {formats.map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportConfig(prev => ({ ...prev, format: fmt.id }))}
                    className={`flex flex-col items-center gap-4 p-6 rounded-[32px] border transition-all duration-300 group ${exportConfig.format === fmt.id
                      ? 'bg-blue-600/15 border-blue-600/50 ring-2 ring-blue-600/10 shadow-2xl'
                      : 'bg-slate-900/30 border-white/5 hover:bg-slate-900/50 text-slate-400'
                      }`}
                  >
                    <fmt.icon className={`w-10 h-10 transition-transform group-hover:scale-110 ${exportConfig.format === fmt.id ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'text-slate-500'}`} />
                    <span className={`text-[10px] font-black text-center uppercase tracking-[0.2em] ${exportConfig.format === fmt.id ? 'text-white' : 'text-slate-500'}`}>{fmt.label}</span>
                  </button>
                ))}
              </div>

              {exportConfig.format === 'rhino' && (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] px-2">Rhino Build</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[7, 8].map(v => (
                      <button
                        key={v}
                        onClick={() => setExportConfig(prev => ({ ...prev, version: v }))}
                        className={`py-4 rounded-2xl border text-xs font-black transition-all ${exportConfig.version === v
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/30'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                      >
                        Version {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] px-2">Project ID</h4>
                <input
                  type="text"
                  placeholder="site_context_export"
                  value={exportConfig.filename}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, filename: e.target.value }))}
                  className="w-full bg-slate-900 border border-white/10 rounded-[20px] px-6 py-5 text-xs font-black text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all tracking-widest"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-10 py-6 bg-[#020617] border-t border-white/5 space-y-4">
          <div className="flex justify-between items-end px-2">
            <div className="space-y-2">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Selection Scope</p>
              <p className={`text-3xl font-black tracking-tighter ${selectedArea > 5 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                {selectedArea.toFixed(3)} <span className="text-sm text-slate-500 font-bold ml-1 tracking-normal">km²</span>
              </p>
            </div>
            {selectedArea > 0 && (
              <button
                onClick={onClearSelection}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 text-slate-400 hover:text-rose-500 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Selection
              </button>
            )}
          </div>

          {selectedArea > 5 && (
            <div className="flex items-start gap-4 p-5 rounded-[24px] bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold leading-relaxed">Region exceeds the 5.0 km² limit. Please scale down selection.</p>
            </div>
          )}

          {!isDownloading ? (
            <div className="flex gap-3">
              {/* Preview Button */}
              <button
                disabled={!canDownload}
                onClick={onPreview}
                className={`flex-1 group flex items-center justify-center gap-3 py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-[0.98] ${canDownload
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10 hover:border-blue-500/30'
                  : 'bg-slate-950 text-slate-700 cursor-not-allowed border border-white/5'
                  }`}
              >
                <Eye className={`w-5 h-5 ${canDownload ? 'group-hover:scale-110 transition-transform' : ''}`} />
                Preview
              </button>

              {/* Download Button */}
              <button
                disabled={!canDownload}
                onClick={onDownload}
                className={`flex-1 group flex items-center justify-center gap-3 py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-[0.98] ${canDownload
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 ring-2 ring-blue-500/20'
                  : 'bg-slate-950 text-slate-700 cursor-not-allowed border border-white/5'
                  }`}
              >
                <Download className={`w-5 h-5 ${canDownload ? 'animate-bounce' : ''}`} />
                Extract
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-2">
                <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] animate-pulse">
                  {status.replace('_', ' ')}
                </p>
                <p className="text-lg font-black text-white font-mono">{progress}%</p>
              </div>
              <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-white/5 p-1 relative">
                <div
                  className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-5 rounded-[24px] bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-bold text-center">
              {errorMessage}
            </div>
          )}

          {status === AppStatus.SUCCESS && (
            <div className="flex items-center justify-center gap-3 p-5 rounded-[24px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Extraction Complete</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
