import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, AlertTriangle, ShieldCheck, TrendingUp, Clock, 
  MapPin, Info, DollarSign, Building, UserCheck, 
  Search, CheckCircle, BrainCircuit, Sparkles
} from 'lucide-react';

const AIInsightsPanel = ({ analysis, duplicates, isAnalyzing }) => {
  if (isAnalyzing) {
    return (
      <div className="glass-card p-8 border border-secondary-500/30 bg-secondary-500/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary-500 to-transparent animate-pulse" />
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
              filter: ["hue-rotate(0deg)", "hue-rotate(180deg)", "hue-rotate(360deg)"]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full bg-secondary-500/20 flex items-center justify-center border border-secondary-500/50"
          >
            <BrainCircuit size={32} className="text-secondary-500" />
          </motion.div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary flex items-center justify-center gap-2">
              <Sparkles className="text-secondary-500 animate-pulse" size={20} />
              AI is Thinking...
            </h3>
            <p className="text-text-tertiary text-sm mt-1 animate-pulse">Analyzing category, severity, and nearby duplicates</p>
          </div>
          
          <div className="w-full max-w-xs h-1.5 bg-bg-tertiary rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-secondary-500 to-transparent"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-secondary-500/20 rounded-lg">
          <BrainCircuit size={18} className="text-secondary-500" />
        </div>
        <h3 className="text-lg font-bold text-text-primary tracking-tight">AI Insights & Predictions</h3>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Confidence: {(analysis.confidenceScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Category & Department */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-5 border border-border-primary bg-gradient-to-br from-bg-secondary to-bg-tertiary relative group"
        >
          <div className="absolute top-3 right-3 text-secondary-500/20 group-hover:text-secondary-500/40 transition-colors">
            <Building size={40} />
          </div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">Department Flow</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-secondary font-medium">Auto-Categorized</p>
              <p className="text-lg font-extrabold text-text-primary capitalize">{analysis.category.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary font-medium">Responsible Unit</p>
              <p className="text-sm font-bold text-secondary-600">{analysis.department}</p>
            </div>
          </div>
        </motion.div>

        {/* Cost & Vendor */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-5 border border-border-primary bg-gradient-to-br from-bg-secondary to-bg-tertiary relative group"
        >
          <div className="absolute top-3 right-3 text-green-500/20 group-hover:text-green-500/40 transition-colors">
            <DollarSign size={40} />
          </div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">Financial Estimate</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-secondary font-medium">Estimated Repair Cost</p>
              <p className="text-2xl font-black text-green-600">₹{analysis.estimatedCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary font-medium">Recommended Vendor</p>
              <p className="text-sm font-bold text-text-primary">{analysis.vendorType}</p>
            </div>
          </div>
        </motion.div>

        {/* Severity & Resolution */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-5 border border-border-primary bg-gradient-to-br from-bg-secondary to-bg-tertiary relative group"
        >
          <div className="absolute top-3 right-3 text-amber-500/20 group-hover:text-amber-500/40 transition-colors">
            <TrendingUp size={40} />
          </div>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">Risk Assessment</p>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-text-secondary font-medium">Severity Level</p>
                <div className={`mt-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter inline-block
                  ${analysis.severity === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 
                    analysis.severity === 'high' ? 'bg-orange-500 text-white' : 
                    analysis.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}
                `}>
                  {analysis.severity}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary font-medium">Resolution Time</p>
                <p className="text-lg font-bold text-text-primary flex items-center gap-1 justify-end">
                  <Clock size={14} className="text-secondary-500" />
                  {analysis.resolutionEstimate}
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${analysis.riskLevel === 'high' ? 90 : analysis.riskLevel === 'medium' ? 60 : 30}%` }}
                className={`h-full ${analysis.riskLevel === 'high' ? 'bg-red-500' : analysis.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`}
               />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Duplicate Warning */}
      <AnimatePresence>
        {duplicates?.isDuplicate && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-4 items-start"
          >
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-600">
              <Search size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-700 flex items-center gap-2">
                Potential Duplicate Detected Nearby
                <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Alert</span>
              </h4>
              <p className="text-xs text-amber-600/80 mt-1 font-medium leading-relaxed">
                We found {duplicates.matches.length} similar issues reported within 500m. 
                This may already be being addressed.
              </p>
              <div className="flex gap-4 mt-3">
                {duplicates.matches.map((m, i) => (
                  <div key={i} className="px-3 py-1.5 bg-white/50 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-700 flex flex-col">
                    <span>#{m.complaint_id} • {m.distance} away</span>
                    <span className="opacity-60">{m.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Summary Card */}
      <div className="glass-card p-6 border border-secondary-500/20 bg-secondary-500/5 flex items-center gap-6 group">
        <div className="w-14 h-14 rounded-2xl bg-secondary-500 flex items-center justify-center text-white shadow-lg shadow-secondary-500/20 group-hover:rotate-6 transition-transform">
          <Info size={28} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-secondary-600 uppercase tracking-widest mb-1">AI Context Summary</p>
          <p className="text-sm text-text-primary font-bold italic leading-relaxed">"{analysis.aiSummary}"</p>
        </div>
        <div className="flex flex-col items-end">
           <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5
             ${analysis.authenticityPrediction > 0.8 ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}
           `}>
             <ShieldCheck size={12} />
             {analysis.authenticityPrediction > 0.8 ? 'Verified Authenticity' : 'High Spam Risk'}
           </div>
           <p className="text-[9px] text-text-tertiary mt-2 font-bold uppercase">Sentiment: {analysis.sentimentScore > 0 ? 'Positive' : 'Distressed'}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsightsPanel;
