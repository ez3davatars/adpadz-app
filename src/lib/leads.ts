export type LeadManagerStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'archived';

export type LeadMetadata = Record<string, unknown> & {
  notes?: string;
  last_contacted_at?: string;
  service_id?: string | null;
  service_name?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  booking_request?: boolean;
};

export type LeadCsvRow = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  smartCard: string;
  status: string;
  createdAt: string;
  notes: string;
  lastContactedAt: string;
  leadType: string;
  requestedService: string;
  preferredDate: string;
  preferredTime: string;
};

export const LEAD_STATUS_OPTIONS: Array<{ value: LeadManagerStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

export const LEAD_HANDOFF_TARGETS = ['csv', 'google_sheets', 'hubspot', 'mailchimp', 'zapier', 'make'] as const;

export function splitLeadName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (!normalized) return { firstName: '', lastName: '' };

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: LeadCsvRow[]): string {
  const headers = ['First Name', 'Last Name', 'Full Name', 'Email', 'Phone', 'Message', 'Source', 'Smart Card', 'Status', 'Created At', 'Notes', 'Last Contacted At', 'Lead Type', 'Requested Service', 'Preferred Date', 'Preferred Time'];
  const lines = rows.map(row => [
    row.firstName,
    row.lastName,
    row.fullName,
    row.email,
    row.phone,
    row.message,
    row.source,
    row.smartCard,
    row.status,
    row.createdAt,
    row.notes,
    row.lastContactedAt,
    row.leadType,
    row.requestedService,
    row.preferredDate,
    row.preferredTime,
  ].map(escapeCsvCell).join(','));

  return [headers.join(','), ...lines].join('\n');
}

export function createLeadCsvFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `adpadz-leads-${year}-${month}-${day}.csv`;
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatLeadCopyBlock(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  source: string;
  message?: string | null;
  createdAt: string;
  leadType?: string;
  requestedService?: string;
  preferredDate?: string;
  preferredTime?: string;
}): string {
  return [
    `Name: ${input.name}`,
    `Email: ${input.email ?? ''}`,
    `Phone: ${input.phone ?? ''}`,
    `Source: ${input.source}`,
    input.leadType ? `Lead Type: ${input.leadType}` : '',
    input.requestedService ? `Requested Service: ${input.requestedService}` : '',
    input.preferredDate ? `Preferred Date: ${input.preferredDate}` : '',
    input.preferredTime ? `Preferred Time: ${input.preferredTime}` : '',
    `Message: ${input.message ?? ''}`,
    `Date: ${input.createdAt}`,
  ].filter(Boolean).join('\n');
}

export function getLeadNotes(metadata: Record<string, unknown> | null | undefined): string {
  return typeof metadata?.notes === 'string' ? metadata.notes : '';
}

export function getLeadLastContactedAt(metadata: Record<string, unknown> | null | undefined): string {
  return typeof metadata?.last_contacted_at === 'string' ? metadata.last_contacted_at : '';
}

export function getLeadRequestedService(metadata: Record<string, unknown> | null | undefined): string {
  return typeof metadata?.service_name === 'string' ? metadata.service_name : '';
}

export function getLeadPreferredDate(metadata: Record<string, unknown> | null | undefined): string {
  return typeof metadata?.preferred_date === 'string' ? metadata.preferred_date : '';
}

export function getLeadPreferredTime(metadata: Record<string, unknown> | null | undefined): string {
  return typeof metadata?.preferred_time === 'string' ? metadata.preferred_time : '';
}

export function formatLeadSourceLabel(source: string): string {
  switch (source) {
    case 'smart_card_public':
      return 'Smart Card';
    case 'smart_card_qr':
      return 'QR Scan';
    case 'smart_card_lead_form':
      return 'Lead Form';
    case 'smart_card_booking':
      return 'Booking Request';
    case 'community_mailer':
      return 'Community Mailer';
    default:
      return source.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }
}
