import { CheckCircle, Clock, AlertCircle, Loader, FileCheck, Truck, Star, XCircle } from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400', label: 'Pending Review', glow: 'neon-glow-pink' },
  under_review: { icon: AlertCircle, color: 'text-accent-cyan', bg: 'bg-accent-cyan', label: 'Under Review', glow: 'neon-glow-cyan' },
  tender_created: { icon: FileCheck, color: 'text-secondary-400', bg: 'bg-secondary-400', label: 'Tender Created', glow: 'neon-glow-purple' },
  assigned: { icon: Truck, color: 'text-accent-pink', bg: 'bg-accent-pink', label: 'Vendor Assigned', glow: 'neon-glow-pink' },
  in_progress: { icon: Loader, color: 'text-orange-400', bg: 'bg-orange-400', label: 'In Progress', glow: 'neon-glow-pink' },
  completed: { icon: CheckCircle, color: 'text-accent-cyan', bg: 'bg-accent-cyan', label: 'Completed', glow: 'neon-glow-cyan' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400', label: 'Rejected', glow: 'neon-glow-pink' },
};

const statusOrder = ['pending', 'under_review', 'tender_created', 'assigned', 'in_progress', 'completed'];

export default function StatusTimeline({ currentStatus }) {
  const currentIdx = statusOrder.indexOf(currentStatus);
  const isRejected = currentStatus === 'rejected';

  return (
    <div className="space-y-2">
      {statusOrder.map((status, idx) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isActive = idx <= currentIdx && !isRejected;
        const isCurrent = status === currentStatus;

        return (
          <div key={status} className="flex items-center gap-4 animate-fade-in" style={{animationDelay: `${idx * 0.1}s`}}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? `${config.bg}/20 ${config.color} ${config.glow} shadow-neon-pink`
                  : 'bg-surface-tertiary/50 text-text-tertiary'
              } ${isCurrent ? 'animate-neon-pulse scale-110' : ''}`}>
                <Icon size={18} className={isCurrent ? 'animate-float' : ''} />
              </div>
              {idx < statusOrder.length - 1 && (
                <div className={`w-0.5 h-8 rounded-full transition-all duration-300 ${
                  isActive && idx < currentIdx ? `${config.bg} ${config.glow}` : 'bg-border-primary'
                }`} />
              )}
            </div>
            <div className={`text-sm transition-colors duration-300 ${
              isActive ? 'text-text-primary font-bold' : 'text-text-tertiary font-medium'
            }`}>
              {config.label}
              {isCurrent && (
                <span className="ml-2 text-xs text-accent-cyan font-bold animate-pulse">
                  (CURRENT)
                </span>
              )}
            </div>
          </div>
        );
      })}
      {isRejected && (
        <div className="flex items-center gap-4 mt-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/20 text-red-400 neon-glow-pink shadow-neon-pink">
            <XCircle size={18} />
          </div>
          <div className="text-sm text-red-400 font-bold">REJECTED</div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-border-primary status-${status} ${config.glow} transition-all duration-300 hover:scale-105`}>
      <config.icon size={14} className="animate-float" />
      {config.label}
    </span>
  );
}
