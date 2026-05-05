import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon,
  Trash2, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Printer, 
  X, 
  Hammer,
  ChevronRight,
  Info
} from 'lucide-react';
import { SiteDocument, RebarScheduleItem, Language, Currency, UnitSystem } from '../types';
import { extractSteelSchedule, auditFixedSteel, getWeightPerM } from '../services/steelAiService';
import { TRANSLATIONS, CURRENCY_SYMBOLS, EXCHANGE_RATES } from '../constants/translations';
import { SteelNipsIcon } from './CustomIcons';

interface SteelFixingHubProps {
  projectMeta: { name: string; location: string };
  onPrint: () => void;
  language: Language;
  currency: Currency;
  unitSystem: UnitSystem;
}

export default function SteelFixingHub({ projectMeta, onPrint, language, currency, unitSystem }: SteelFixingHubProps) {
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [schedule, setSchedule] = useState<RebarScheduleItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [wastagePercent, setWastagePercent] = useState(5);

  const t = (key: string) => TRANSLATIONS[language][key] || key;
  const currencySymbol = CURRENCY_SYMBOLS[currency];
  const rate = EXCHANGE_RATES[currency];

  const isImperial = unitSystem === UnitSystem.IMPERIAL;

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

  const runVisionExtraction = async (doc: SiteDocument) => {
    setIsAnalyzing(true);
    const items = await extractSteelSchedule(doc.url);
    const enrichedItems = items.map((item: any) => {
      const unitWeight = getWeightPerM(item.typeSize); // this is kg/m or lbs/ft based on drawing
      // If imperial, weight is already lbs per linear foot. Total = count * length * lbs/ft
      // If metric, weight is kg/m. Total = count * length * kg/m
      return {
        ...item,
        weightPerM: unitWeight,
        totalWeight: item.count * item.length * unitWeight 
      };
    });
    setSchedule(enrichedItems);
    setIsAnalyzing(false);
  };

  const runRealityCheck = async (doc: SiteDocument) => {
    setIsAnalyzing(true);
    const scheduleStr = schedule.map(i => `${i.mark}: ${i.typeSize}, ${i.count}nr`).join('\n');
    const result = await auditFixedSteel(doc.url, scheduleStr);
    setAuditResult(result);
    setIsAnalyzing(false);
  };

  const boq = useMemo(() => {
    const netWeight = schedule.reduce((acc, curr) => acc + curr.totalWeight, 0);
    const grossWeight = netWeight * (1 + wastagePercent / 100);
    
    // Wire rolls: 1 roll per 1 metric tonne or per 2000 lbs
    const factor = isImperial ? 2000 : 1000;
    const rolls = Math.ceil(grossWeight / factor);
    
    const totalBars = schedule.reduce((acc, curr) => acc + curr.count, 0);
    const spacers = Math.ceil(totalBars * 1.5);

    return {
      totalWeight: grossWeight,
      tyingWireRolls: rolls,
      spacers: spacers,
      wastage: netWeight * (wastagePercent / 100)
    };
  }, [schedule, wastagePercent, isImperial]);

  const weightUnit = isImperial ? 'lbs' : 'kg';
  const largeWeightUnit = isImperial ? 'US Tons' : 'tonnes';
  const lengthUnit = isImperial ? 'ft' : 'm';

  const formatWeight = (w: number) => {
    if (isImperial) {
      if (w > 4000) return `${(w / 2000).toFixed(3)} ${largeWeightUnit}`;
      return `${w.toFixed(0)} ${weightUnit}`;
    }
    if (w > 1000) return `${(w / 1000).toFixed(3)} tonnes`;
    return `${w.toFixed(1)} kg`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 bg-[#1e293b] border-b border-brand-border flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-steel-blue text-white rounded shadow-sm">
            <SteelNipsIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">
            {isImperial ? 'US Rebar & Reinforcement Hub' : 'Steel Fixing & Reinforcement Hub'}
          </h2>
        </div>

        <div className="flex gap-3 no-print">
          <button onClick={onPrint} className="btn-secondary w-auto px-4">
            <Printer size={16} /> {t('export_pdf')}
          </button>
        </div>
      </header>

      <div className="p-8 space-y-8 flex-1 overflow-y-auto">
        {/* Upload Zone */}
        <section className="no-print grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-dark p-8 flex flex-col items-center justify-center border-dashed border-2 gap-4 hover:border-steel-blue transition-all cursor-pointer group relative">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'drawing')} />
            <div className="p-4 bg-steel-blue/10 rounded-full group-hover:bg-steel-blue/20 transition-all">
              <Upload size={40} className="text-steel-blue" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase">{language === 'en' ? 'UPLOAD REBAR SCHEDULE' : t('drawings')}</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{t('drawings')}</p>
            </div>
          </div>

          <div className="card-dark p-8 flex flex-col items-center justify-center border-dashed border-2 gap-4 hover:border-steel-blue transition-all cursor-pointer group relative">
            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'photo')} />
            <div className="p-4 bg-steel-blue/10 rounded-full group-hover:bg-steel-blue/20 transition-all">
              <Camera size={40} className="text-steel-blue" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white uppercase">{language === 'en' ? 'SCAN FIXED STEEL' : t('site_photo')}</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{t('site_photo')}</p>
            </div>
          </div>
        </section>

        {/* Gallery & Analysis */}
        {documents.length > 0 && (
          <section className="no-print">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon size={18} className="text-slate-500" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Site Documents</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {documents.map(doc => (
                <div key={doc.id} className="card-dark p-2 relative group aspect-square overflow-hidden">
                  <img src={doc.url} className="w-full h-full object-cover rounded" alt={doc.name} />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-2">
                    <button 
                      onClick={() => doc.type === 'drawing' ? runVisionExtraction(doc) : runRealityCheck(doc)}
                      disabled={isAnalyzing}
                      className="px-3 py-1 bg-steel-blue text-white text-[10px] font-bold rounded"
                    >
                      {isAnalyzing ? '...' : (doc.type === 'drawing' ? 'EXTRACT' : 'AUDIT')}
                    </button>
                    <button onClick={() => setDocuments(p => p.filter(d => d.id !== doc.id))} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Audit Results */}
        <AnimatePresence>
          {auditResult && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-steel-blue/10 border border-steel-blue/50 rounded-lg p-5 flex gap-4 items-start relative overflow-hidden"
            >
              <Info className="text-steel-blue shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase text-steel-blue bg-steel-blue/20 px-2 py-0.5 rounded">Analysis Completed</span>
                  <span className="text-[10px] text-slate-500 italic">Vision Scan Analysis</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{auditResult}</p>
              </div>
              <button onClick={() => setAuditResult(null)} className="text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule Table */}
        {schedule.length > 0 && (
          <div className="card-dark">
            <div className="p-4 border-b border-brand-border bg-brand-panel flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Extracted Rebar Schedule</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Wastage %:</span>
                  <input 
                    type="number" 
                    value={wastagePercent}
                    onChange={(e) => setWastagePercent(parseInt(e.target.value) || 0)}
                    className="w-16 bg-brand-bg border border-slate-700 rounded p-1 text-xs text-steel-blue text-center"
                  />
                </div>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand-border text-[11px] font-bold text-slate-500 uppercase">
                  <th className="p-4">Bar Mark</th>
                  <th className="p-4">Type & Size</th>
                  <th className="p-4 text-center">Count</th>
                  <th className="p-4 text-center">Length ({lengthUnit})</th>
                  <th className="p-4 text-right">Total ({weightUnit === 'lbs' ? 'lbs' : 'kg'})</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {schedule.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-steel-blue">{item.mark}</td>
                    <td className="p-4">{item.typeSize}</td>
                    <td className="p-4 text-center">{item.count}</td>
                    <td className="p-4 text-center">{item.length.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono">{item.totalWeight.toFixed(isImperial ? 0 : 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-brand-panel text-white font-bold text-sm">
                <tr>
                  <td colSpan={4} className="p-4 text-right text-slate-500 uppercase text-[10px]">Net Weight</td>
                  <td className="p-4 text-right">{formatWeight(schedule.reduce((a,b) => a + b.totalWeight, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Steel BOQ Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="TOTAL STEEL REBAR" value={formatWeight(boq.totalWeight)} sub={`incl. ${wastagePercent}% wastage`} />
          <StatCard title={isImperial ? "Tying Wire" : "Tying Wire"} value={`${boq.tyingWireRolls} Rolls`} sub="McGurk Site Ration" />
          <StatCard title="Chairs/Spacers" value={`${boq.spacers} nr`} sub="McGurk Density Ratio" />
          <StatCard title="Off-cut Wastage" value={formatWeight(boq.wastage)} sub="Calculated variance" />
        </div>

        {/* Print Appendix (Drawings) */}
        <div className="hidden print:block pt-12 border-t-2 border-slate-300">
          <h2 className="text-xl font-bold uppercase mb-6 text-black">Technical Appendix: Drawings & Visual Audit</h2>
          <div className="grid grid-cols-2 gap-8">
            {documents.map((doc, idx) => (
              <div key={idx} className="space-y-2">
                <img src={doc.url} className="w-full border shadow-sm rounded" alt={doc.name} />
                <div className="flex justify-between text-[10px] text-slate-500 italic">
                  <span>REF {idx + 1}: {doc.name}</span>
                  <span>TIME: {new Date(doc.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub }: any) {
  return (
    <div className="card-dark p-6 flex flex-col gap-1 border-l-4 border-l-steel-blue">
      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{title}</div>
      <div className="text-2xl font-mono text-white font-bold">{value}</div>
      <div className="text-[10px] text-slate-600 font-medium italic">{sub}</div>
    </div>
  );
}
