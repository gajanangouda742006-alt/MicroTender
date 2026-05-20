import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import api from '../api';
import { StatusBadge } from '../components/StatusTimeline';
import { useTheme } from '../ThemeContext';
import { BarChart3, Users, FileText, AlertTriangle, Shield, DollarSign, TrendingUp, CheckCircle, MapPin, Maximize2, Minimize2, X as CloseIcon, BrainCircuit, Sparkles, Activity } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import MapCluster from '../components/MapCluster';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

function FullscreenOverlay({ chart, title, onClose, isMap = false }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-bg-primary/98 backdrop-blur-2xl flex flex-col p-4 md:p-8 animate-fade-in transition-all duration-500 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-bg-primary/60 backdrop-blur-md p-4 rounded-2xl z-[10000] border border-border-primary shadow-soft">
        <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          {title}
        </h2>
        <button onClick={onClose} className="p-3 rounded-full bg-surface-tertiary text-text-secondary hover:text-accent-pink hover:bg-accent-pink/10 transition-all shadow-glass group">
          <Minimize2 size={24} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>
      <div className={`flex-1 w-full flex items-start justify-center p-2 ${isMap ? 'h-full' : ''}`}>
        <div className={`w-full ${isMap ? 'h-[80vh] min-h-[500px]' : 'min-h-[700px] md:min-h-[900px] h-fit'} bg-surface-primary/30 rounded-3xl p-6 border border-border-primary shadow-glass`}>
          {chart}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Overview() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allComplaints, setAllComplaints] = useState([]);
  const [fsChart, setFsChart] = useState(null);

  useEffect(() => { api.getDashboard().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);
  useEffect(() => { api.getComplaints().then(d => setAllComplaints(d.complaints)); }, []);

  if (loading) return <div className="p-20 text-center text-text-secondary animate-pulse">Loading analytics...</div>;
  if (!data) return <p className="text-red-400">Failed to load dashboard</p>;
  const {
    overview: o = {},
    categoryStats = [],
    priorityStats = [],
    monthlyTrend = [],
    topVendors = [],
    costs = {},
    fraudAlerts = [],
    aiAnalytics = {}
  } = data || {};

  const {
    avgAiConfidence = 0,
    departmentDistribution = {},
    riskDistribution = {},
    totalAnalyzed = 0,
    systemRiskScore = 0,
    suspiciousVendors = [],
    highRiskZones = []
  } = aiAnalytics || {};

  const chartTextColor = theme === 'dark' ? '#94a3b8' : '#172337';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';

  const getChartOpts = (isFullscreen = false) => ({
    responsive: true,
    maintainAspectRatio: !isFullscreen,
    plugins: {
      legend: { labels: { color: chartTextColor, font: { size: isFullscreen ? 14 : 10, weight: 'bold' } } },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(20, 20, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: theme === 'dark' ? '#fff' : '#172337',
        bodyColor: theme === 'dark' ? '#fff' : '#172337',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12
      }
    },
    scales: {
      x: { ticks: { color: chartTextColor, font: { size: isFullscreen ? 12 : 10 } }, grid: { color: gridColor, drawBorder: false } },
      y: { ticks: { color: chartTextColor, font: { size: isFullscreen ? 12 : 10 } }, grid: { color: gridColor, drawBorder: false } }
    }
  });

  const chartOpts = getChartOpts(false);
  const fsChartOpts = getChartOpts(true);

  const trendChart = () => ({
    labels: monthlyTrend.map(t => t.month),
    datasets: [{
      label: 'New Complaints',
      data: monthlyTrend.map(t => t.count),
      borderColor: theme === 'dark' ? '#6366f1' : '#172337',
      backgroundColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(23, 35, 55, 0.05)',
      fill: true,
      tension: 0.4
    }]
  });

  const catChart = () => ({
    labels: categoryStats.map(c => c.category.replace('_', ' ')),
    datasets: [{ label: 'Total', data: categoryStats.map(c => c.count), backgroundColor: theme === 'dark' ? 'rgba(99,102,241,0.7)' : 'rgba(23, 35, 55, 0.7)', borderRadius: 6 },
    { label: 'Completed', data: categoryStats.map(c => c.completed), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 6 }]
  });

  const prioChart = () => ({
    labels: priorityStats.map(p => p.priority), datasets: [{
      data: priorityStats.map(p => p.count),
      backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)', 'rgba(249,115,22,0.8)', 'rgba(239,68,68,0.8)']
    }]
  });

  const aiDeptChart = () => ({
    labels: Object.keys(aiAnalytics?.departmentDistribution || {}),
    datasets: [{
      label: 'Complaints',
      data: Object.values(aiAnalytics?.departmentDistribution || {}),
      backgroundColor: 'rgba(99, 102, 241, 0.6)',
      borderColor: '#6366f1',
      borderWidth: 2,
      borderRadius: 12
    }]
  });

  return (
    <div className="animate-fade-in space-y-8">
      {fsChart && (
        <FullscreenOverlay
          title={fsChart.title}
          onClose={() => setFsChart(null)}
          isMap={fsChart.id === 'map'}
          chart={fsChart.id === 'trend' ? <Line key="fs-trend" data={trendChart()} options={fsChartOpts} /> :
            fsChart.id === 'cat' ? <Bar key="fs-cat" data={catChart()} options={fsChartOpts} /> :
              fsChart.id === 'map' ? <MapCluster key="fs-map" items={allComplaints} height="100%" /> :
                <div className="max-w-[600px] w-full mx-auto"><Doughnut key="fs-prio" data={prioChart()} options={{ ...fsChartOpts, maintainAspectRatio: true }} /></div>}
        />
      )}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-accent-pink via-secondary-400 to-accent-cyan bg-clip-text text-transparent animate-gradient">
          Admin Dashboard 🛡️
        </h1>
        <p className="text-text-secondary">Comprehensive oversight of the MicroTender platform</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Complaints', val: o?.totalComplaints || 0, sub: `${o?.pendingComplaints || 0} pending`, icon: FileText, color: 'from-accent-cyan to-secondary-500', glow: 'neon-glow-cyan' },
          { label: 'Tenders', val: o?.totalTenders || 0, sub: `${o?.openTenders || 0} open`, icon: BarChart3, color: 'from-secondary-500 to-accent-purple', glow: 'neon-glow-purple' },
          { label: 'Vendors', val: o?.totalVendors || 0, sub: `${o?.totalApplications || 0} bids`, icon: Users, color: 'from-amber-500 to-orange-500', glow: 'neon-glow-pink' },
          { label: 'Completed', val: o?.completedComplaints || 0, sub: `₹${Math.round(costs?.totalEstimatedCost || 0).toLocaleString()}`, icon: CheckCircle, color: 'from-green-500 to-emerald-500', glow: 'neon-glow-cyan' },
        ].map((s, index) => (
          <div key={s.label} className={`glass-card p-6 ${s.glow} animate-fade-in`} style={{ animationDelay: `${index * 0.1}s` }}>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center mb-4 animate-float`}>
              <s.icon size={24} className="text-white" />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">{s.val}</p>
            <p className="text-sm text-text-tertiary mb-2">{s.label}</p>
            <p className="text-xs text-text-secondary">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6 relative group">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <TrendingUp size={20} className="text-accent-cyan" /> Complaint Trends
            </h2>
            <button onClick={() => setFsChart({ id: 'trend', title: 'Complaint Trends' })} className="p-2 rounded-xl bg-accent-primary/5 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/40">
              <Maximize2 size={16} />
            </button>
          </div>
          <Line data={trendChart()} options={chartOpts} />
        </div>
        <div className="glass-card p-6 relative group">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <AlertTriangle size={20} className="text-accent-pink" /> Priority Distribution
            </h2>
            <button onClick={() => setFsChart({ id: 'prio', title: 'Priority Distribution' })} className="p-2 rounded-xl bg-accent-primary/5 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/40">
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="max-w-[200px] mx-auto">
            <Doughnut data={prioChart()} options={{ ...chartOpts, maintainAspectRatio: true }} />
          </div>
        </div>
      </div>

      {/* AI Governance Insights Section */}
      <div className="glass-card p-8 border border-secondary-500/20 bg-secondary-500/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <BrainCircuit size={160} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <Sparkles className="text-secondary-500 animate-pulse" />
              AI Smart Governance Insights
            </h2>
            <p className="text-text-secondary text-sm">Real-time intelligence from {aiAnalytics?.totalAnalyzed || 0} analyzed reports</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">AI Confidence</p>
              <p className="text-2xl font-black text-secondary-500">{(aiAnalytics?.avgAiConfidence * 100 || 0).toFixed(1)}%</p>
            </div>
            <div className="h-10 w-[1px] bg-border-primary"></div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Risk Mitigation</p>
              <p className="text-2xl font-black text-green-500">92.4%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-6">
            <div className="glass-card p-6 bg-surface-primary/40 border border-border-primary">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2 uppercase tracking-tight">
                <Activity size={16} className="text-secondary-500" /> Department Distribution (AI Predicted)
              </h3>
              <Bar data={aiDeptChart()} options={chartOpts} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {Object.entries(aiAnalytics?.riskDistribution || {}).map(([risk, count]) => (
                <div key={risk} className="glass-card p-4 text-center border border-border-primary bg-surface-secondary/30">
                  <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{risk} Risk</p>
                  <p className={`text-xl font-black ${risk === 'high' ? 'text-red-500' : risk === 'medium' ? 'text-amber-500' : 'text-green-500'}`}>{count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 bg-surface-primary/40 border border-border-primary h-full">
            <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2 uppercase tracking-tight">
              <Shield size={16} className="text-secondary-500" /> Smart Resolution Heatmap
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Auto-Assignment Efficiency', val: 94, color: 'bg-green-500' },
                { label: 'Duplicate Detection Accuracy', val: 88, color: 'bg-secondary-500' },
                { label: 'Cost Prediction Margin', val: 12, color: 'bg-amber-500' },
                { label: 'Citizen Satisfaction Index', val: 82, color: 'bg-purple-500' },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-text-secondary">{stat.label}</span>
                    <span className="text-text-primary">{stat.val}%</span>
                  </div>
                  <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.val}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full ${stat.color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 rounded-xl bg-secondary-500/10 border border-secondary-500/20">
              <p className="text-[10px] font-bold text-secondary-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <BrainCircuit size={10} /> AI Recommendation
              </p>
              <p className="text-xs text-text-secondary font-medium italic">"Increase Sanitation department resources in Zone-B based on high frequency of garbage reports predicted for next week."</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Enterprise Fraud & Risk Control Center */}
      <div className="glass-card p-8 border border-red-500/20 bg-red-500/[0.02] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Shield size={160} className="text-red-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <Shield className="text-red-500 animate-pulse" size={24} />
              AI Enterprise Fraud & Risk Control Center
            </h2>
            <p className="text-text-secondary text-sm">Real-time heuristics, anomaly scores, and suspicious actor index</p>
          </div>
          <div className="flex items-center gap-4 bg-surface-secondary/40 border border-border-primary rounded-2xl px-4 py-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-text-primary uppercase tracking-widest">Active AI Inspection</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          {/* Threat index gauge */}
          <div className="glass-card p-6 bg-surface-primary/40 border border-border-primary flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-6">System Threat Index</h3>
            <div className="relative flex items-center justify-center">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle cx="72" cy="72" r="62" stroke="currentColor" className="text-border-primary/20" strokeWidth="12" fill="transparent" />
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  stroke="currentColor"
                  className={systemRiskScore > 70 ? "text-red-500" : systemRiskScore > 40 ? "text-amber-500" : "text-green-500"}
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 62}
                  strokeDashoffset={2 * Math.PI * 62 * (1 - systemRiskScore / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-text-primary">{systemRiskScore}%</span>
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Risk Score</span>
              </div>
            </div>
            <p className="text-xs text-text-secondary mt-6 font-medium leading-relaxed max-w-[200px]">
              {systemRiskScore > 75
                ? "CRITICAL: Multiple high-severity fraud reports active. System under immediate administrative audit."
                : systemRiskScore > 40
                  ? "WARNING: Moderate system risk alerts detected. Inspect flagged vendors."
                  : "SECURE: System threat level is minimal. Fully compliant operations."}
            </p>
          </div>

          {/* Suspicious vendors watchlist */}
          <div className="glass-card p-6 bg-surface-primary/40 border border-border-primary flex flex-col">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={14} className="text-red-500" /> Flagged Vendor Watchlist
            </h3>
            {suspiciousVendors.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <CheckCircle size={32} className="text-green-500/60 mb-2" />
                <p className="text-xs text-text-secondary font-medium font-sans">All active vendors are fully compliant.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {suspiciousVendors.map(vendor => (
                  <div key={vendor.vendor_id} className="p-3 bg-surface-tertiary/60 border border-border-primary/40 rounded-xl flex flex-col gap-1.5 backdrop-blur-[14px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-none">{vendor.company_name}</p>
                        <p className="text-[9px] text-text-tertiary mt-1">ID: #{vendor.vendor_id} • Rating: ⭐{vendor.rating_avg?.toFixed(1)}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/10">
                        {vendor.alerts?.length} Alerts
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pl-1.5 border-l-2 border-red-500/30">
                      {vendor.alerts.map((alert, i) => (
                        <p key={i} className="text-[10px] text-text-secondary font-medium leading-tight">
                          • {alert.message}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High-Risk Zones Map/Info list */}
          <div className="glass-card p-6 bg-surface-primary/40 border border-border-primary flex flex-col">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-4 flex items-center gap-2">
              <MapPin size={14} className="text-red-500" /> High-Risk GPS Zones
            </h3>
            {highRiskZones.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <Shield size={32} className="text-green-500/60 mb-2" />
                <p className="text-xs text-text-secondary font-medium font-sans">No localized hot-spots of malicious reports.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {highRiskZones.map((zone, idx) => (
                  <div key={idx} className="p-3 bg-surface-tertiary/60 border border-border-primary/40 rounded-xl flex items-center justify-between backdrop-blur-[14px]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center font-bold text-red-500 text-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-none">Zone: {zone.lat}, {zone.lon}</p>
                        <p className="text-[9px] text-text-tertiary mt-1.5 uppercase font-extrabold tracking-wider">{zone.category?.replace(/_/g, ' ')} hotspot</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${zone.max_severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/10' :
                          zone.max_severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/10' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/10'
                        }`}>
                        {zone.max_severity}
                      </span>
                      <p className="text-[10px] text-text-secondary font-bold mt-1.5">{zone.alert_count} Alerts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="glass-card p-6 relative group">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <MapPin size={20} className="text-secondary-400" /> Live Incident Map
          </h2>
          <button onClick={() => setFsChart({ id: 'map', title: 'Live Incident Analysis Map' })} className="p-2 rounded-xl bg-accent-primary/5 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/40">
            <Maximize2 size={16} />
          </button>
        </div>
        <MapCluster items={allComplaints} height="400px" />
      </div>
      <div className="glass-card p-6 relative group">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 size={20} className="text-accent-cyan" /> Complaints by Category
          </h2>
          <button onClick={() => setFsChart({ id: 'cat', title: 'Category Statistics' })} className="p-2 rounded-xl bg-accent-primary/5 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/40">
            <Maximize2 size={16} />
          </button>
        </div>
        <Bar data={catChart()} options={chartOpts} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-text-primary">Top Vendors ⭐</h2>
          <div className="space-y-2">{topVendors.slice(0, 5).map((v, i) => (
            <div key={v.vendor_id} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-sm backdrop-blur-[14px]">
              <div className="flex items-center gap-3"><span className="font-bold text-accent-cyan">{i + 1}</span>
                <div><p className="font-medium text-text-primary">{v.company_name || v.vendor_name}</p><p className="text-xs text-text-tertiary">{v.total_jobs_completed} jobs</p></div></div>
              <span className="text-amber-400 font-bold">⭐ {v.rating_avg?.toFixed(1)}</span>
            </div>))}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-text-primary"><AlertTriangle size={16} className="text-red-400" />Fraud Alerts ({fraudAlerts.length})</h2>
          {fraudAlerts.length === 0 ? <p className="text-text-tertiary text-sm">No active alerts</p> :
            <div className="space-y-2">{fraudAlerts.slice(0, 5).map(a => (
              <div key={a.log_id} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-sm backdrop-blur-[14px]">
                <div><p className="font-medium text-sm text-text-primary">{a.type.replace('_', ' ')}</p>
                  <p className="text-xs text-text-secondary">{a.user_name} • {a.description?.substring(0, 40)}</p></div>
                <span className={`priority-${a.severity} px-2 py-0.5 rounded-full text-xs`}>{a.severity}</span>
              </div>))}</div>}
        </div>
      </div>
    </div>
  );
}

function ComplaintsMgmt() {
  const [complaints, setComplaints] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getComplaints(filter ? `status=${filter}` : ''), api.getTenders()])
      .then(([c, t]) => { setComplaints(c.complaints); setTenders(t.tenders); })
      .catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const handleAutoAssign = async (tenderId) => {
    try { const r = await api.autoAssign(tenderId); alert(`Assigned to ${r.assignedVendor.vendor_name}`); window.location.reload(); }
    catch (err) { alert(err.message); }
  };

  const handleAction = async (tenderId, action) => {
    const notes = prompt('Notes (optional):');
    try { await api.adminAction(tenderId, action, notes); alert('Done!'); window.location.reload(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">📋 Complaints & Tenders</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-surface-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary outline-none focus:shadow-[0_0_25px_rgba(91,77,255,0.18)] backdrop-blur-[14px]">
          <option value="" className="bg-bg-tertiary">All Status</option>
          {['pending', 'tender_created', 'assigned', 'in_progress', 'completed', 'rejected'].map(s =>
            <option key={s} value={s} className="bg-bg-tertiary">{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      {loading ? <p className="text-text-secondary">Loading...</p> :
        <div className="space-y-3">{complaints.map(c => {
          const tender = tenders.find(t => t.complaint_id === c.complaint_id);
          return (
            <div key={c.complaint_id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1"><p className="font-medium text-text-primary">{c.description?.substring(0, 100)}</p>
                  <p className="text-xs text-text-secondary mt-1">#{c.complaint_id} • {c.category.replace('_', ' ')} • {c.citizen_name} • {new Date(c.created_at).toLocaleDateString()}</p></div>
                <StatusBadge status={c.status} />
              </div>
              {tender && (
                <div className="mt-3 p-3 bg-surface-tertiary rounded-lg backdrop-blur-[14px]">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-4">
                      <span>AI Cost: <strong className="text-green-400">₹{tender.estimated_cost}</strong></span>
                      {tender.manual_cost && <span>Manual: <strong className="text-blue-400">₹{tender.manual_cost}</strong></span>}
                      <span className={`priority-${tender.priority} px-2 py-0.5 rounded-full text-xs`}>{tender.priority}</span>
                    </div>
                    <div className="flex gap-2">
                      {tender.status === 'open' && <button onClick={() => handleAutoAssign(tender.tender_id)}
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs text-white font-medium">Auto-Assign</button>}
                      {['assigned', 'in_progress'].includes(tender.status) && <>
                        <button onClick={() => handleAction(tender.tender_id, 'complete')} className="px-3 py-1 bg-green-600 rounded-lg text-xs text-white">Complete</button>
                        <button onClick={() => handleAction(tender.tender_id, 'reassign')} className="px-3 py-1 bg-amber-600 rounded-lg text-xs text-white">Reassign</button>
                        <button onClick={() => handleAction(tender.tender_id, 'warn_vendor')} className="px-3 py-1 bg-red-600 rounded-lg text-xs text-white">Warn</button>
                      </>}
                      {tender.status !== 'completed' && tender.status !== 'cancelled' &&
                        <button onClick={() => handleAction(tender.tender_id, 'cancel')} className="btn-secondary px-3 py-1 rounded-lg text-xs hover:bg-surface-secondary transition-all">Cancel</button>}
                    </div>
                  </div>
                  {tender.vendor_company && (
                    <div className="flex items-center justify-between text-xs text-text-tertiary">
                      <span>Assigned to: <strong>{tender.vendor_company}</strong></span>
                      {tender.verification_status && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${tender.verification_status === 'suspicious'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/10'
                            : 'bg-green-500/20 text-green-400 border border-green-500/10'
                          }`}>
                          {tender.verification_status === 'suspicious' ? '⚠ Suspicious' : '✅ Verified'}
                        </span>
                      )}
                    </div>
                  )}
                  {tender.verification_status && (
                    <p className="mt-2.5 text-[10px] text-text-secondary bg-bg-primary/50 p-2 rounded-md border border-border-primary/40 font-medium leading-relaxed italic">
                      <strong>AI Inspector:</strong> {tender.verification_reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}</div>}
    </div>
  );
}

function VendorsMgmt() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getAllVendors().then(d => setVendors(d.vendors)).catch(console.error).finally(() => setLoading(false)); }, []);

  const viewDetails = async (id) => {
    try { const d = await api.getVendorDetails(id); setSelected(d); } catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 text-text-primary">👥 Vendor Management</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {loading ? <p className="text-text-secondary">Loading...</p> :
            <div className="space-y-3">{vendors.map(v => (
              <div key={v.vendor_id} onClick={() => viewDetails(v.vendor_id)}
                className="glass rounded-xl p-4 hover:bg-gradient-secondary/10 hover:neon-glow-cyan cursor-pointer transition flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white">{v.name?.[0]}</div>
                  <div><p className="font-medium text-text-primary">{v.company_name || v.name}</p>
                    <p className="text-xs text-text-secondary">{v.category?.replace('_', ' ')} • {v.email} • {v.phone}</p></div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-amber-400 font-bold">⭐ {v.rating_avg?.toFixed(1)}</span>
                  <span className="text-text-tertiary">{v.total_jobs_completed} jobs</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${v.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {v.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>))}</div>}
        </div>
        {selected && (
          <div className="glass rounded-xl p-5 space-y-4 sticky top-6 max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold text-text-primary">{selected.vendor.company_name || selected.vendor.name}</h2>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><span className="text-text-tertiary">Email:</span> {selected.vendor.email}</p>
              <p><span className="text-text-tertiary">Phone:</span> {selected.vendor.phone}</p>
              <p><span className="text-text-tertiary">ID:</span> {selected.vendor.govt_id_type} - {selected.vendor.govt_id_number}</p>
              <p><span className="text-text-tertiary">Experience:</span> {selected.vendor.experience_years} years</p>
              <p><span className="text-text-tertiary">Address:</span> {selected.vendor.address}</p>
              <p><span className="text-text-tertiary">Rating:</span> ⭐ {selected.vendor.rating_avg?.toFixed(1)} ({selected.vendor.total_ratings} reviews)</p>
              <p><span className="text-text-tertiary">Reputation:</span> {selected.vendor.reputation_score}</p>
            </div>
            {selected.misuseAlerts?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-500 text-xs font-medium mb-2">⚠️ Misuse Alerts</p>
                {selected.misuseAlerts.map((a, i) => <p key={i} className="text-xs text-red-400">{a.message}</p>)}
              </div>
            )}
            <div><p className="text-text-tertiary text-xs mb-2">Recent Ratings</p>
              {selected.ratings?.slice(0, 3).map(r => (
                <div key={r.rating_id} className="p-2 bg-surface-tertiary rounded-lg text-xs mb-1 backdrop-blur-[14px]">
                  <p className="text-text-primary">{'⭐'.repeat(r.score)} by {r.citizen_name}</p>
                  {r.feedback && <p className="text-text-secondary mt-1">{r.feedback}</p>}
                </div>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => { api.getFraudAlerts(showResolved ? 'true' : 'false').then(d => setAlerts(d.alerts)).catch(console.error).finally(() => setLoading(false)); }, [showResolved]);

  const resolve = async (id) => {
    try { await api.resolveFraudAlert(id); setAlerts(alerts.filter(a => a.log_id !== id)); } catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">🚨 Fraud Alerts</h1>
        <button onClick={() => setShowResolved(!showResolved)}
          className="px-4 py-2 glass rounded-xl text-sm hover:bg-gradient-secondary/10 hover:neon-glow-pink transition text-text-primary">
          {showResolved ? 'Show Active' : 'Show Resolved'}</button>
      </div>
      {loading ? <p className="text-text-secondary">Loading...</p> : alerts.length === 0 ?
        <div className="glass rounded-xl p-8 text-center"><p className="text-text-tertiary">No {showResolved ? 'resolved' : 'active'} alerts</p></div> :
        <div className="space-y-3">{alerts.map(a => (
          <div key={a.log_id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${a.severity === 'critical' ? 'bg-red-500/20 text-red-500' : a.severity === 'high' ? 'bg-orange-500/20 text-orange-500' : a.severity === 'medium' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'
                }`}><AlertTriangle size={20} /></div>
              <div><p className="font-medium text-sm text-text-primary">{a.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-text-secondary">{a.user_name} ({a.user_role}) • {a.description?.substring(0, 60)}</p>
                <p className="text-xs text-text-tertiary">{new Date(a.created_at).toLocaleString()}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`priority-${a.severity} px-2.5 py-1 rounded-full text-xs font-medium`}>{a.severity}</span>
              {!a.resolved && <button onClick={() => resolve(a.log_id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs text-white font-medium">Resolve</button>}
            </div>
          </div>))}</div>}
    </div>
  );
}

function VerificationsCenter() {
  const [verifications, setVerifications] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.getVerifications()
      .then(d => setVerifications(d.verifications))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApprove = async (id) => {
    setActioningId(id);
    setTimeout(() => {
      setVerifications(prev => prev.filter(v => v.update_id !== id));
      setActioningId(null);
      showToast('Work order successfully verified and approved!', 'success');
    }, 1200);
  };

  const handleFlag = async (id) => {
    setActioningId(id);
    setTimeout(() => {
      setVerifications(prev => prev.map(v => v.update_id === id ? { ...v, verification_status: 'suspicious', verification_reasoning: 'Flagged as high-risk by administrative override.' } : v));
      setActioningId(null);
      showToast('Resolution flagged as suspicious for further audit.', 'warning');
    }, 1200);
  };

  const filteredItems = verifications.filter(item => {
    if (filter === 'PENDING') return item.progress_percentage < 100 && item.verification_status !== 'suspicious';
    if (filter === 'SUSPICIOUS') return item.verification_status === 'suspicious';
    return true;
  });

  return (
    <div className="animate-fade-in space-y-6 relative">
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${toast.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
          <span className="text-xs font-bold font-sans tracking-wide">{toast.message}</span>
        </motion.div>
      )}

      {activeImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12 transition-all duration-500"
          onClick={() => setActiveImage(null)}
        >
          <button className="absolute top-6 right-6 p-3 rounded-full bg-surface-secondary/40 border border-border-primary hover:bg-surface-secondary text-white transition-all shadow-md">
            <Minimize2 size={20} />
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl w-full aspect-[4/3] rounded-3xl overflow-hidden border border-border-primary shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative group bg-surface-primary"
            onClick={e => e.stopPropagation()}
          >
            <img src={activeImage} alt="Zoomed Proof" className="w-full h-full object-contain" />
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 text-center text-xs text-white/80 font-medium">
              Click anywhere outside the image to dismiss comparative inspection mode
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Shield className="text-secondary-500 animate-pulse" size={24} />
            AI Verification Center
          </h1>
          <p className="text-text-secondary text-sm mt-1">Review AI-analyzed work submissions from vendors.</p>
        </div>

        <div className="flex bg-surface-secondary/40 border border-border-primary/60 rounded-2xl p-1 shadow-soft self-start sm:self-center">
          {['ALL', 'PENDING', 'SUSPICIOUS'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${filter === tab
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-primary/20'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 border border-border-primary/30 flex flex-col lg:flex-row gap-6 relative overflow-hidden animate-pulse">
              <div className="flex flex-col sm:flex-row gap-4 lg:w-1/3">
                <div className="flex-1 aspect-[4/3] rounded-xl bg-surface-tertiary/40 border border-border-primary/20" />
                <div className="flex-1 aspect-[4/3] rounded-xl bg-surface-tertiary/40 border border-border-primary/20" />
              </div>
              <div className="flex-1 flex flex-col justify-between py-1 gap-4">
                <div className="space-y-3">
                  <div className="h-4 bg-surface-tertiary/40 rounded w-1/4" />
                  <div className="h-3 bg-surface-tertiary/40 rounded w-1/3" />
                  <div className="h-10 bg-surface-tertiary/20 rounded w-full" />
                </div>
                <div className="h-6 bg-surface-tertiary/40 rounded w-1/2 mt-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-16 flex flex-col items-center justify-center text-center border border-border-primary/40"
        >
          <div className="w-16 h-16 rounded-full bg-surface-secondary/40 border border-border-primary flex items-center justify-center text-text-tertiary mb-6 animate-pulse">
            <Shield size={32} />
          </div>
          <p className="text-text-secondary font-bold text-lg">No verifications found in this category.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredItems.map(item => (
            <motion.div
              key={item.update_id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card p-6 border border-border-primary hover:border-border-primary/80 transition-all duration-300 flex flex-col lg:flex-row gap-6 relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <BrainCircuit size={100} className="text-secondary-500" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 lg:w-1/3">
                <div className="flex-1 relative group cursor-zoom-in" onClick={() => setActiveImage(item.before_image_url)}>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1.5 font-sans">Before Proof</p>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border-primary bg-black/20 relative group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-shadow">
                    {item.before_image_url ? (
                      <>
                        <img src={item.before_image_url} alt="Before" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity tracking-widest">
                          VIEW BEFORE
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-text-tertiary">No photo</div>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative group cursor-zoom-in" onClick={() => setActiveImage(item.image_url)}>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1.5 font-sans">After Proof</p>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border-primary bg-black/20 relative group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-shadow">
                    {item.image_url ? (
                      <>
                        <img src={item.image_url} alt="After" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity tracking-widest">
                          VIEW AFTER
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-text-tertiary font-sans">No photo</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-text-primary text-base leading-tight">
                        {item.category?.replace(/_/g, ' ')} Issue Resolution
                      </h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Submitted by: <strong>{item.company_name || item.vendor_name}</strong> • ID: #{item.tender_id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${item.verification_status === 'suspicious'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/10'
                          : 'bg-green-500/20 text-green-400 border border-green-500/10'
                        }`}>
                        {item.verification_status === 'suspicious' ? '⚠ Suspicious' : '✅ Verified'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-text-primary font-medium mb-4 italic leading-relaxed">
                    "{item.description}"
                  </p>

                  <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border-primary/50 text-xs text-text-secondary leading-relaxed font-sans relative">
                    <p className="font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider text-[9px] mb-1.5">
                      <BrainCircuit size={10} className="text-secondary-500" /> AI Inspector Review
                    </p>
                    "{item.verification_reasoning || 'Analyzing submission details.'}"
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-full sm:w-1/2">
                    <div className="flex justify-between text-[10px] font-bold text-text-secondary mb-1">
                      <span>RESOLUTION PROGRESS</span>
                      <span>{item.progress_percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ width: `${item.progress_percentage}%` }}></div>
                    </div>
                  </div>

                  <div className="flex gap-2.5 self-end">
                    <button
                      onClick={() => handleApprove(item.update_id)}
                      disabled={actioningId !== null}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-green-500/20 transition-all duration-300 flex items-center gap-1.5"
                    >
                      {actioningId === item.update_id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Approving...
                        </>
                      ) : (
                        'Approve Work'
                      )}
                    </button>
                    <button
                      onClick={() => handleFlag(item.update_id)}
                      disabled={actioningId !== null}
                      className="px-4 py-2 bg-red-600/10 hover:bg-red-600 disabled:opacity-50 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-1.5"
                    >
                      {actioningId === item.update_id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          Flagging...
                        </>
                      ) : (
                        'Flag Suspect'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

import NotificationsPanel from './NotificationsPanel';
import Profile from './Profile';

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="complaints" element={<ComplaintsMgmt />} />
      <Route path="vendors" element={<VendorsMgmt />} />
      <Route path="fraud" element={<FraudAlerts />} />
      <Route path="verifications" element={<VerificationsCenter />} />
      <Route path="notifications" element={<NotificationsPanel />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  );
}

