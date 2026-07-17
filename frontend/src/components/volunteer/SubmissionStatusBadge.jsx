import {
  CheckCircle2,
  Clock3,
  FileEdit,
  FileText,
  Search,
  XCircle,
} from 'lucide-react';

const statusConfigurations = {
  draft: {
    label: 'Draft',
    color: '#5D6470',
    background: '#F0F1F3',
    border: '#D9DCE1',
    icon: FileText,
  },

  pending_review: {
    label: 'Pending Review',
    color: '#8A6100',
    background: '#FFF7D6',
    border: '#EEDB8D',
    icon: Clock3,
  },

  changes_requested: {
    label: 'Changes Requested',
    color: '#9A4B00',
    background: '#FFF0DC',
    border: '#EAC69E',
    icon: FileEdit,
  },

  published: {
    label: 'Published',
    color: '#176B38',
    background: '#E7F7ED',
    border: '#B9DFC7',
    icon: CheckCircle2,
  },

  rejected: {
    label: 'Rejected',
    color: '#A52222',
    background: '#FDEAEA',
    border: '#F0C3C3',
    icon: XCircle,
  },
};

export default function SubmissionStatusBadge({
  status = 'pending_review',
}) {
  const normalizedStatus =
    String(status || 'pending_review').toLowerCase();

  const configuration =
    statusConfigurations[normalizedStatus] ||
    statusConfigurations.pending_review;

  const StatusIcon = configuration.icon;

  return (
    <span
      title={configuration.label}
      style={{
        ...styles.badge,
        color: configuration.color,
        background:
          configuration.background,
        borderColor: configuration.border,
      }}
    >
      <StatusIcon size={12} />
      {configuration.label}
    </span>
  );
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '5px 9px',
    border: '1px solid',
    borderRadius: 50,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
};
