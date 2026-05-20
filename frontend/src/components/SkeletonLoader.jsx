import { motion } from 'framer-motion';

export default function SkeletonLoader({ type = 'card' }) {
  const shimmerEffect = (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
  );

  if (type === 'card') {
    return (
      <div className="glass-card p-6 border border-border-primary overflow-hidden relative group">
        {shimmerEffect}
        <div className="flex items-start justify-between mb-4">
          <div className="w-16 h-6 bg-bg-tertiary rounded-full shadow-inner" />
          <div className="w-20 h-4 bg-bg-tertiary rounded shadow-inner" />
        </div>
        <div className="w-3/4 h-6 bg-bg-tertiary rounded mb-2 shadow-inner" />
        <div className="w-1/2 h-4 bg-bg-tertiary rounded mb-4 shadow-inner" />
        <div className="w-full h-16 bg-bg-tertiary rounded-xl shadow-inner" />
      </div>
    );
  }
  
  if (type === 'stat') {
    return (
      <div className="glass-card p-6 border border-border-primary relative overflow-hidden group">
        {shimmerEffect}
        <div className="w-12 h-12 bg-bg-tertiary rounded-xl mb-4 shadow-inner" />
        <div className="w-20 h-8 bg-bg-tertiary rounded mb-2 shadow-inner" />
        <div className="w-24 h-4 bg-bg-tertiary rounded shadow-inner" />
      </div>
    );
  }

  return (
    <div className="w-full h-10 bg-bg-tertiary rounded-xl relative overflow-hidden shadow-inner">
      {shimmerEffect}
    </div>
  );
}
