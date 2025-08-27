interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function InvoiceStatusBadge({ status, className = "" }: StatusBadgeProps) {
  const getStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'void':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'partially_paid':
        return 'Partially Paid';
      default:
        return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'Unknown';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(
        status
      )} ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}

export function DealStageBadge({ status, className = "" }: StatusBadgeProps) {
  const getStageStyles = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'won':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'lost':
      case 'abandoned':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'contract signed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'contract sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'negotiation':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'contacted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStageStyles(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
}