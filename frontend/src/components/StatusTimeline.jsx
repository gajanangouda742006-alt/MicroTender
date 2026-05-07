import { CheckCircle, Clock, AlertCircle, Loader, FileCheck, Truck, Star, XCircle } from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400', label: 'Pending Review' },
  under_review: { icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-400', label: 'Under Review' },
  tender_created: { icon: FileCheck, color: 'text-purple-400', bg: 'bg-purple-400', label: 'Tender Created' },
  assigned: { icon: Truck, color: 'text-cyan-400', bg: 'bg-cyan-400', label: 'Vendor Assigned' },
  in_progress: { icon: Loader, color: 'text-orange-400', bg: 'bg-orange-400', label: 'In Progress' },
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400', label: 'Completed' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400', label: 'Rejected' },
};

const statusOrder = ['pending', 'under_review', 'tender_created', 'assigned', 'in_progress', 'completed'];

export default function StatusTimeline({ currentStatus }) {
  const currentIdx = statusOrder.indexOf(currentStatus);
  const isRejected = currentStatus === 'rejected';

  return (
    <div className="space-y-1">
      {statusOrder.map((status, idx) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isActive = idx <= currentIdx && !isRejected;
        const isCurrent = status === currentStatus;

        return (
          <div key={status} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isActive ? `${config.bg}/20 ${config.color}` : 'bg-gray-800 text-gray-600'
              } ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-dark-900 ring-primary-500 animate-pulse-glow' : ''}`}>
                <Icon size={16} />
              </div>
              {idx < statusOrder.length - 1 && (
                <div className={`w-0.5 h-6 ${isActive && idx < currentIdx ? config.bg : 'bg-gray-800'}`} />
              )}
            </div>
            <div className={`text-sm ${isActive ? 'text-white font-medium' : 'text-gray-600'}`}>
              {config.label}
              {isCurrent && <span className="ml-2 text-xs text-primary-400">(current)</span>}
            </div>
          </div>
        );
      })}
      {isRejected && (
        <div className="flex items-center gap-3 mt-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-400/20 text-red-400 ring-2 ring-red-500">
            <XCircle size={16} />
          </div>
          <div className="text-sm text-red-400 font-medium">Rejected</div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium status-${status}`}>
      <config.icon size={12} />
      {config.label}
    </span>
  );
}
