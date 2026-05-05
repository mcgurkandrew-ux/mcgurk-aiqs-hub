/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Settings2, 
  Printer, 
  Ruler, 
  Box, 
  Coins, 
  ArrowRightLeft,
  Construction,
  Hammer,
  Info,
  ChevronRight,
  HardHat,
  FileText,
  DollarSign,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dimensions, UnitSystem, ProjectSettings, DEFAULT_SETTINGS, BOQItem, SiteDocument, ProjectState, Language, Currency } from './types';
import { calculateBOQ, convertToMetric, parseFeetInches } from './utils/calculations';
import { analyzeDrawing, visualAudit } from './services/aiService';
import SteelFixingHub from './components/SteelFixingHub';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from './constants/translations';
import { HammerSawIcon, SteelNipsIcon } from './components/CustomIcons';

export default function App() {
  // -- Persistent State --
  const [activeHub, setActiveHub] = useState<'formwork' | 'steel'>('formwork');
  const [language, setLanguage] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [isLoaded, setIsLoaded] = useState(false);

  // -- Helpers --
  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const currencySymbol = CURRENCY_SYMBOLS[currency];
  const rate = EXCHANGE_RATES[currency];

  const formatPrice = (price: number) => {
    const converted = price * rate;
    return `${currencySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const [projectMeta, setProjectMeta] = useState({ name: '', location: '' });
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [reviewData, setReviewData] = useState<any>(null);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  const [dims, setDims] = useState<Dimensions>({
    length: 10,
    height: 3,
    thickness: 0.3,
    unitSystem: UnitSystem.METRIC,
    imperial: {
      lengthFt: 32,
      lengthIn: 10,
      heightFt: 9,
      heightIn: 10,
      thicknessIn: 12
    }
  });

  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({
    concrete: 125,
    plywood_sheets: 45,
    primary_timber: 4.5,
    secondary_timber: 3.2,
    steel: 1.85,
    dywi_bars: 12,
    hardware: 1.2,
    agent: 5.5
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // -- Persistence Logic --
  useEffect(() => {
    const saved = localStorage.getItem('mcgurk_aiqs_project');
    if (saved) {
      try {
        const state: ProjectState = JSON.parse(saved);
        setActiveHub(state.activeHub || 'formwork');
        setLanguage(state.language || 'en');
        setCurrency(state.currency || 'GBP');
        setDims(state.dims);
        setSettings(state.settings);
        setUnitCosts(state.unitCosts || {});
        setDocuments(state.documents || []);
        setProjectMeta({ name: state.name || '', location: state.location || '' });
      } catch (e) {
        console.error("Failed to load project state", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const state: ProjectState = {
        activeHub,
        language,
        currency,
        name: projectMeta.name,
        location: projectMeta.location,
        dims,
        settings,
        unitCosts,
        documents
      };
      localStorage.setItem('mcgurk_aiqs_project', JSON.stringify(state));
    }
  }, [isLoaded, activeHub, language, currency, dims, settings, unitCosts, documents, projectMeta]);

  // -- Derived --
  const boqItems = useMemo(() => {
    return calculateBOQ(dims, settings, unitCosts);
  }, [dims, settings, unitCosts]);

  const grandTotal = useMemo(() => {
    return boqItems.reduce((sum, item) => sum + item.totalCost, 0);
  }, [boqItems]);

  // -- Handlers --
  const handleDimChange = (field: keyof Dimensions | string, value: any) => {
    setDims(prev => {
      const next = { ...prev };
      
      if (typeof field === 'string' && field.includes('.')) {
        const [parent, child] = field.split('.');
        (next as any)[parent][child] = Number(value);
        
        // Auto-sync metric from imperial if that's what changed
        if (parent === 'imperial') {
          if (child.startsWith('length')) {
            next.length = convertToMetric(next.imperial.lengthFt, next.imperial.lengthIn);
          } else if (child.startsWith('height')) {
            next.height = convertToMetric(next.imperial.heightFt, next.imperial.heightIn);
          } else if (child.startsWith('thickness')) {
            next.thickness = convertToMetric(0, next.imperial.thicknessIn);
          }
        }
      } else {
        (next as any)[field] = value;
      }
      
      return next;
    });
  };

  const handleUnitCostChange = (id: string, val: string) => {
    const cost = parseFloat(val) || 0;
    setUnitCosts(prev => ({ ...prev, [id]: cost }));
  };

  const handlePrint = () => {
    const fileName = `${projectMeta.name || 'Project'}_${projectMeta.location || 'Report'}`.replace(/\s+/g, '_');
    document.title = fileName;
    window.print();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'drawing') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newDoc: SiteDocument = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        url: base64,
        name: file.name,
        timestamp: Date.now()
      };
      setDocuments(prev => [...prev, newDoc]);
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const runVisionAnalysis = async (doc: SiteDocument) => {
    setIsAnalyzing(true);
    setAnalysisStatus('scanning');
    if (doc.type === 'drawing') {
      import('./services/aiService').then(async ({ analyzeDrawing }) => {
        const result = await analyzeDrawing(doc.url);
        if (result) {
          setReviewData(result);
          setAnalysisStatus('success');
        } else {
          setAnalysisStatus('idle');
        }
        setIsAnalyzing(false);
      });
    } else {
      const summary = boqItems.map(i => `${i.name}: ${i.quantity} ${i.unit}`).join('\n');
      import('./services/aiService').then(async ({ visualAudit }) => {
        const result = await visualAudit(doc.url, summary);
        setAuditResult(result);
        setAnalysisStatus('idle');
        setIsAnalyzing(false);
      });
    }
  };

  const handleConfirmAnalysis = () => {
    if (!reviewData) return;
    if (reviewData.length) handleDimChange('length', reviewData.length);
    if (reviewData.height) handleDimChange('height', reviewData.height);
    if (reviewData.thickness) handleDimChange('thickness', reviewData.thickness);
    
    if (reviewData.isComplex) {
      setSettings(prev => ({ ...prev, plywoodWastage: 40 }));
    }

    setReviewData(null);
    setAnalysisStatus('idle');
  };

  const runRealityBridge = async () => {
    const drawing = documents.find(d => d.type === 'drawing');
    const photo = documents.find(d => d.type === 'photo');
    if (!drawing || !photo) {
      alert("Requires 1 Drawing and 1 Site Photo for Reality Bridge.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus('scanning');
    import('./services/aiService').then(async ({ compareSiteToDrawing }) => {
      const result = await compareSiteToDrawing(drawing.url, photo.url);
      setAuditResult(result);
      setAnalysisStatus('idle');
      setIsAnalyzing(false);
    });
  };

  return (
    <div className="min-h-screen flex bg-brand-bg text-slate-200 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Sidebar: Project Control Center */}
      <aside className={`no-print sidebar-container w-72 fixed left-0 top-0 bottom-0 z-20 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col gap-8 overflow-y-auto">
          {/* Hub Switcher */}
          <div className="flex bg-brand-bg p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => setActiveHub('formwork')}
              className={`flex-1 flex flex-col items-center py-2 rounded transition-all ${activeHub === 'formwork' ? 'bg-[#FBCC14] text-black shadow-[0_2px_0_#b99511]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <HammerSawIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-1 uppercase">{t('formwork')}</span>
            </button>
            <button 
              onClick={() => setActiveHub('steel')}
              className={`flex-1 flex flex-col items-center py-2 rounded transition-all ${activeHub === 'steel' ? 'bg-steel-blue text-white shadow-[0_2px_0_#2b5171]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <SteelNipsIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-1 uppercase">{t('steel')}</span>
            </button>
          </div>

          {/* Global Config Section */}
          <section className="space-y-4">
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-bold">{t('region')} & PRESETS</label>
            <div className="space-y-3">
              <select 
                className="input-field" 
                onChange={(e) => {
                  const region = e.target.value;
                  if (region === 'UK') {
                    setCurrency('GBP');
                    setLanguage('en');
                    handleDimChange('unitSystem', UnitSystem.METRIC);
                  } else if (region === 'USA') {
                    setCurrency('USD');
                    setLanguage('en');
                    handleDimChange('unitSystem', UnitSystem.IMPERIAL);
                  } else if (region === 'ES') {
                    setCurrency('USD');
                    setLanguage('es');
                  }
                }}
              >
                <option value="">Select Region Preset...</option>
                <option value="USA">United States (USD/FT-IN)</option>
                <option value="UK">United Kingdom (GBP/METRIC)</option>
                <option value="MZ">Mozambique (USD/EN)</option>
                <option value="EU">Europe (USD/FR/IT/ES)</option>
              </select>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">{t('language')}</span>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="input-field text-xs"
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                    <option value="it">Italiano</option>
                    <option value="zh">简体中文</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">{t('currency')}</span>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="input-field text-xs"
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="CNY">CNY (¥)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Logo Section */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold">{t('system_status')}: {t('active_hub')}</div>
            <h1 className="text-xl font-light text-white leading-tight">
              McGurk AIQS Specialist<br/>
              <span className="font-bold underline decoration-amber-500">{activeHub === 'formwork' ? t('formwork') : t('steel')}</span> Hub
            </h1>
          </div>

          <div className="space-y-6">
            {/* Project Context */}
            <section>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-bold">{t('project_context')}</label>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder={t('project_context') + "..."}
                  className="input-field"
                  value={projectMeta.name}
                  onChange={(e) => setProjectMeta(p => ({ ...p, name: e.target.value }))}
                />
                <input 
                  type="text" 
                  placeholder={t('site_location') + "..."}
                  className="input-field"
                  value={projectMeta.location}
                  onChange={(e) => setProjectMeta(p => ({ ...p, location: e.target.value }))}
                />
                <div className="p-3 bg-slate-900/50 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">{t('last_sync')}</div>
                  <div className="text-xs text-slate-400 font-mono italic">Today, {new Date().toLocaleTimeString()}</div>
                </div>
              </div>
            </section>

            {/* Site Documents Section */}
            <section className="space-y-4">
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800 pb-2">{t('attach_docs')}</label>
              
              {analysisStatus !== 'idle' && (
                <div className={`p-2 rounded text-[10px] font-bold uppercase text-center transition-all ${analysisStatus === 'scanning' ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
                  {analysisStatus === 'scanning' ? (
                    <span className="flex items-center justify-center gap-2 italic"><Search size={12} /> {language === 'zh' ? '正在扫描图纸...' : 'Scanning Drawing...'}</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><CheckCircle2 size={12} /> {language === 'zh' ? '数据提取成功' : 'Data Extracted Successfully'}</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center p-3 bg-brand-panel border border-slate-800 rounded cursor-pointer hover:border-amber-500 transition-all group">
                  <Camera size={20} className="text-slate-400 group-hover:text-amber-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-500 group-hover:text-slate-300">{t('site_photo')}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} />
                </label>
                <label className="flex flex-col items-center justify-center p-3 bg-brand-panel border border-slate-800 rounded cursor-pointer hover:border-amber-500 transition-all group">
                  <Upload size={20} className="text-slate-400 group-hover:text-amber-500 mb-1" />
                  <span className="text-[9px] uppercase font-bold text-slate-500 group-hover:text-slate-300">{t('drawings')}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'drawing')} />
                </label>
              </div>

              {/* Reality Bridge Action */}
              {documents.some(d => d.type === 'drawing') && documents.some(d => d.type === 'photo') && (
                <button 
                  onClick={runRealityBridge}
                  disabled={isAnalyzing}
                  className="w-full py-3 bg-slate-800 border-b-4 border-slate-900 active:border-b-0 active:translate-y-[2px] rounded text-[10px] font-bold uppercase text-slate-400 hover:text-amber-500 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <ArrowRightLeft size={14} /> {language === 'en' ? 'Compare Drawing to Site Photo' : 'Comparer Plan et Photo'}
                </button>
              )}
            </section>

            {/* Custom Wastage Section */}
            <section className="space-y-4">
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800 pb-2">{t('wastage')}</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-tighter">{t('plywood')}</span>
                  <input 
                    type="number" 
                    value={settings.plywoodWastage}
                    onChange={(e) => setSettings(prev => ({ ...prev, plywoodWastage: parseInt(e.target.value) || 0 }))}
                    className="input-field-amber" 
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-tighter">{t('concrete')}</span>
                  <input 
                    type="number" 
                    value={settings.concreteWastage}
                    onChange={(e) => setSettings(prev => ({ ...prev, concreteWastage: parseInt(e.target.value) || 0 }))}
                    className="input-field-amber" 
                  />
                </div>
              </div>
            </section>

            {/* Engineering Specs */}
            <section className="space-y-4">
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800 pb-2">{t('engineering_specs')}</label>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-tighter">{t('rebar_density')} (kg/m³)</span>
                  <input 
                    type="number" 
                    value={settings.reinforcementRatio}
                    onChange={(e) => setSettings(prev => ({ ...prev, reinforcementRatio: parseFloat(e.target.value) || 0 }))}
                    className="input-field" 
                  />
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="pt-4 space-y-3">
              <button className="btn-primary">
                <Calculator size={16} />
                {t('calculate_boq')}
              </button>
              <button onClick={handlePrint} className="btn-secondary">
                <Printer size={16} />
                {t('export_pdf')}
              </button>
            </section>
          </div>

          {/* Footer Total Overlay */}
          <div className="mt-auto">
            <div className="p-4 bg-brand-panel rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">{t('total_cost')}</div>
              <div className="text-2xl font-mono text-white tracking-tighter">
                {formatPrice(grandTotal)}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebars and Main Content Switcher */}
      {activeHub === 'steel' ? (
        <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}>
          <SteelFixingHub 
            projectMeta={projectMeta} 
            onPrint={handlePrint} 
            language={language} 
            currency={currency} 
            unitSystem={dims.unitSystem} 
          />
        </main>
      ) : (
        /* Main Analysis Engine (Formwork) */
        <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}>
          {/* Header Bar */}
          <header className={`no-print h-16 border-b border-brand-border flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-500 ${activeHub === 'formwork' ? 'bg-[#111822]' : 'bg-[#1e293b]'}`}>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1 hover:bg-slate-800 rounded text-slate-500 transition-colors"
              >
                <ChevronRight className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded ${activeHub === 'formwork' ? 'bg-[#FBCC14] text-black shadow-sm' : 'bg-steel-blue text-white shadow-sm'}`}>
                  {activeHub === 'formwork' ? <HammerSawIcon className="w-5 h-5" /> : <SteelNipsIcon className="w-5 h-5" />}
                </div>
                <div className="font-bold uppercase tracking-tight text-white hidden sm:block">
                  McGurk <span className="font-light opacity-50">Hub</span>
                </div>
                {dims.unitSystem === UnitSystem.IMPERIAL && (
                  <div className="bg-blue-600/20 border border-blue-500/50 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400">
                    REGION: USA
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('unit_system')}:</span>
                <div className="flex bg-brand-bg p-1 rounded border border-slate-800">
                  <button 
                    onClick={() => handleDimChange('unitSystem', UnitSystem.IMPERIAL)}
                    className={`px-4 py-1 text-[11px] font-bold rounded transition-all ${dims.unitSystem === UnitSystem.IMPERIAL ? 'bg-brand-accent text-black shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    IMPERIAL
                  </button>
                  <button 
                    onClick={() => handleDimChange('unitSystem', UnitSystem.METRIC)}
                    className={`px-4 py-1 text-[11px] font-bold rounded transition-all ${dims.unitSystem === UnitSystem.METRIC ? 'bg-brand-accent text-black shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    METRIC
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic font-mono uppercase">
              McGurk AIQS • {t('formwork')} Engine v4.2.0 • {dims.unitSystem}
            </div>
          </header>

          {/* Workspace */}
          <div className="p-8 space-y-6">
            {/* AI Audit Notification */}
            {auditResult && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-4 flex gap-4 items-start relative overflow-hidden"
              >
                <AlertTriangle className="text-amber-500 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold uppercase text-amber-500 mb-1">Reality Check (OSHA / Site Standards)</h4>
                  <p className="text-sm text-slate-300 italic">{auditResult}</p>
                </div>
                <button onClick={() => setAuditResult(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
              </motion.div>
            )}

            {/* Dimension Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DimensionCard 
                label={t('length')}
                system={dims.unitSystem}
                metricValue={dims.length}
                ftVal={dims.imperial.lengthFt}
                inVal={dims.imperial.lengthIn}
                onUpdateFt={(v) => handleDimChange('imperial.lengthFt', v)}
                onUpdateIn={(v) => handleDimChange('imperial.lengthIn', v)}
                onUpdateMetric={(v) => handleDimChange('length', v)}
              />
              <DimensionCard 
                label={t('height')}
                system={dims.unitSystem}
                metricValue={dims.height}
                ftVal={dims.imperial.heightFt}
                inVal={dims.imperial.heightIn}
                onUpdateFt={(v) => handleDimChange('imperial.heightFt', v)}
                onUpdateIn={(v) => handleDimChange('imperial.heightIn', v)}
                onUpdateMetric={(v) => handleDimChange('height', v)}
              />
              <DimensionCard 
                label={t('thickness')}
                system={dims.unitSystem}
                metricValue={dims.thickness * 1000} // display mm
                isThickness={true}
                ftVal={0}
                inVal={dims.imperial.thicknessIn}
                onUpdateFt={() => {}}
                onUpdateIn={(v) => handleDimChange('imperial.thicknessIn', v)}
                onUpdateMetric={(v) => handleDimChange('thickness', v / 1000)}
              />
            </div>

            {/* Results Table Section */}
            <div className="card-dark print:border-slate-300 print:text-black">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-brand-panel border-b border-brand-border print:bg-slate-100 print:border-slate-300">
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">{t('item_description')}</th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">{t('quantity')}</th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center print:text-slate-600">{t('unit')}</th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">{t('unit_cost')} ({currencySymbol})</th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right print:text-slate-600">{t('total')} ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-800/50 print:divide-slate-200">
                    {boqItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors group print:text-black">
                        <td className="p-4">
                          <div className="font-medium text-slate-100 print:text-black">{t(item.id) || item.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono print:text-slate-400">{item.description}</div>
                        </td>
                        <td className="p-4 font-mono text-slate-300 print:text-black">
                          {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center text-slate-500 font-medium print:text-slate-600">{t(item.unit) || item.unit}</td>
                        <td className="p-4">
                          <input 
                            type="number"
                            step="0.01"
                            value={unitCosts[item.id] || ''}
                            onChange={(e) => handleUnitCostChange(item.id, e.target.value)}
                            className="bg-brand-bg border border-slate-700 rounded px-2 py-1 w-24 text-right font-mono text-amber-500 focus:border-amber-500 outline-none transition-all print:border-none print:text-black print:text-right print:w-auto"
                          />
                        </td>
                        <td className="p-4 text-right font-mono text-white font-bold print:text-black">
                          {formatPrice(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Appendix: Site Documents (Print Only) */}
            {documents.length > 0 && (
              <div className="hidden print:block pt-10 mt-10 border-t-2 border-slate-300">
                <h3 className="text-xl font-bold mb-6 text-slate-900 uppercase">Appendix: Site Documents & Evidence</h3>
                <div className="grid grid-cols-2 gap-8">
                  {documents.map((doc, idx) => (
                    <div key={doc.id} className="space-y-2">
                      <img src={doc.url} className="w-full border-2 border-slate-200 rounded" alt={doc.name} />
                      <div className="flex justify-between text-[10px] text-slate-500 italic">
                        <span>Document {idx + 1}: {doc.name}</span>
                        <span>Attached: {new Date(doc.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Footer Summary (Non-print) */}
          <footer className="no-print h-12 mt-auto bg-brand-sidebar border-t border-brand-border flex items-center px-8 text-[11px] justify-between">
            <div className="flex gap-8">
              <span className="flex gap-2">
                <strong className="text-slate-500 uppercase tracking-tighter">{t('surface_area')}:</strong> 
                <span className="text-slate-300 font-mono">{(dims.length * dims.height * 2).toFixed(2)} m²</span>
              </span>
              <span className="flex gap-2">
                <strong className="text-slate-500 uppercase tracking-tighter">{t('volume')}:</strong> 
                <span className="text-slate-300 font-mono">{(dims.length * dims.height * dims.thickness).toFixed(2)} m³</span>
              </span>
            </div>
            <div className="text-slate-600 font-mono">
              © AIQS HUB SPEC FW v4.2.0 • {dims.unitSystem.toUpperCase()} MODE • {currency}
            </div>
          </footer>

          {/* Price Disclaimer (Print Only) */}
          <div className="hidden print:block text-[10px] text-slate-500 italic mt-4 text-center">
            * All costs converted from base rates using fixed AIQS market exchange rates ({currency} @ {rate.toFixed(2)}).
          </div>
        </main>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-[#111822] border-t border-slate-800 active:pb-safe sm:hidden no-print z-50 flex items-center justify-around px-4">
        <button 
          onClick={() => setActiveHub('formwork')}
          className={`flex flex-col items-center gap-1 transition-all ${activeHub === 'formwork' ? 'text-[#FBCC14]' : 'text-slate-500'}`}
        >
          <HammerSawIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">{t('formwork')}</span>
        </button>
        <button 
          onClick={() => setActiveHub('steel')}
          className={`flex flex-col items-center gap-1 transition-all ${activeHub === 'steel' ? 'text-steel-blue' : 'text-slate-500'}`}
        >
          <SteelNipsIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">{t('steel')}</span>
        </button>
      </nav>

      {/* Review & Confirm Modal */}
      <AnimatePresence>
        {reviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-dark max-w-lg w-full overflow-hidden border-amber-500/50 border-2"
            >
              <div className="p-4 bg-amber-500 text-black flex justify-between items-center">
                <h3 className="font-bold uppercase tracking-tight flex items-center gap-2">
                  <Search size={18} /> Review & Confirm Extracted Data
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <ReviewItem label={t('length')} value={`${reviewData.length?.toFixed(3) || '--'} m`} />
                  <ReviewItem label={t('height')} value={`${reviewData.height?.toFixed(3) || '--'} m`} />
                  <ReviewItem label={t('thickness')} value={`${(reviewData.thickness * 1000)?.toFixed(0) || '--'} mm`} />
                  <ReviewItem label="Kicker" value={reviewData.kickerHeight || '--'} />
                  <ReviewItem label="FW Type" value={reviewData.formworkType || '--'} />
                  <ReviewItem label="Strike Time" value={reviewData.strikeTime || '--'} />
                </div>

                {reviewData.isComplex && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/50 rounded flex gap-3 items-start">
                    <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                    <div>
                      <h4 className="text-[10px] font-bold text-amber-500 uppercase">Specialist Shuttering Alert</h4>
                      <p className="text-[11px] text-slate-300">Complex geometry detected. Plywood wastage will be adjusted to 40%.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setReviewData(null)}
                    className="flex-1 py-3 border border-slate-700 rounded text-xs font-bold uppercase hover:bg-slate-800 transition-all"
                  >
                    Discard Scan
                  </button>
                  <button 
                    onClick={handleConfirmAnalysis}
                    className="flex-1 py-3 bg-amber-500 text-black rounded text-xs font-bold uppercase hover:bg-amber-400 transition-all"
                  >
                    Confirm & Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
      <div className="text-lg font-mono text-white border-b border-slate-800 pb-1">{value}</div>
    </div>
  );
}

function DimensionCard({ 
  label, 
  system, 
  metricValue, 
  ftVal, 
  inVal, 
  onUpdateFt, 
  onUpdateIn, 
  onUpdateMetric,
  isThickness = false
}: any) {
  const [quickInput, setQuickInput] = useState(`${ftVal || 0}' ${inVal || 0}"`);

  // Sync quick input if external values change
  useEffect(() => {
    if (system === UnitSystem.IMPERIAL) {
      setQuickInput(`${ftVal || 0}' ${inVal || 0}"`);
    }
  }, [ftVal, inVal, system]);

  const handleQuickInput = (val: string) => {
    setQuickInput(val);
    const parsed = parseFeetInches(val);
    if (parsed) {
      onUpdateFt(parsed.ft);
      onUpdateIn(parsed.in);
    }
  };

  return (
    <div className="card-dark p-5 flex flex-col gap-4">
      <div className="text-[11px] text-slate-500 uppercase font-bold tracking-widest border-b border-slate-800 pb-2 text-left">
        {label}
      </div>
      
      {system === UnitSystem.IMPERIAL ? (
        <div className="space-y-3">
          <div className="relative">
            <input 
              type="text" 
              value={quickInput} 
              onChange={(e) => handleQuickInput(e.target.value)}
              placeholder={"e.g. 50' 6\""}
              className="w-full bg-brand-bg border border-slate-700 p-2 rounded text-brand-accent font-mono text-center focus:border-brand-accent outline-none" 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Quick Entry</div>
          </div>
          <div className="flex gap-2 items-center">
            {!isThickness && (
              <>
                <input 
                  type="number" 
                  value={ftVal} 
                  onChange={(e) => onUpdateFt(e.target.value)}
                  className="w-full bg-brand-bg border border-slate-700 p-2 rounded text-slate-400 font-mono text-center focus:border-slate-800 outline-none text-xs" 
                />
                <span className="text-[10px] text-slate-600 italic font-mono">ft</span>
              </>
            )}
            <input 
              type="number" 
              value={inVal} 
              onChange={(e) => onUpdateIn(e.target.value)}
              className="w-full bg-brand-bg border border-slate-700 p-2 rounded text-slate-400 font-mono text-center focus:border-slate-800 outline-none text-xs" 
            />
            <span className="text-[10px] text-slate-600 italic font-mono">in</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <input 
            type="number" 
            value={metricValue} 
            onChange={(e) => onUpdateMetric(e.target.value)}
            className="w-full bg-brand-bg border border-slate-700 p-2 rounded text-amber-500 font-mono text-center focus:border-amber-500 outline-none" 
          />
          <span className="text-[10px] text-slate-600 italic font-mono">{isThickness ? 'mm' : 'm'}</span>
        </div>
      )}

      <div className="text-[10px] text-slate-600 font-mono mt-1 italic text-left">
        {system === UnitSystem.IMPERIAL 
          ? `Metric Sync: ${isThickness ? (metricValue).toFixed(1) + ' mm' : (metricValue).toFixed(3) + ' m'}`
          : `Imperial: ${isThickness ? (metricValue / 25.4).toFixed(2) + '"' : (metricValue * 3.28084).toFixed(2) + ' ft'}`
        }
      </div>
    </div>
  );
}
