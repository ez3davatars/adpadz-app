import {
  Archive,
  CheckSquare,
  Copy,
  Download,
  Loader,
  Mail,
  MessageSquareText,
  Phone,
  Save,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LEAD_HANDOFF_TARGETS,
  LEAD_STATUS_OPTIONS,
  buildCsv,
  createLeadCsvFilename,
  downloadCsv,
  formatLeadCopyBlock,
  formatLeadSourceLabel,
  getLeadLastContactedAt,
  getLeadNotes,
  getLeadPreferredDate,
  getLeadPreferredTime,
  getLeadRequestedService,
  splitLeadName,
  type LeadCsvRow,
  type LeadManagerStatus,
  type LeadMetadata,
} from '../../lib/leads';

type LeadStatusFilter = 'all' | LeadManagerStatus;

type SmartCardLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string;
  status: LeadManagerStatus;
  lead_type: string;
  metadata: LeadMetadata | null;
  created_at: string;
  updated_at?: string | null;
  card?: {
    business_name?: string | null;
    slug?: string | null;
  } | null;
};

const FILTERS: LeadStatusFilter[] = ['all', 'new', 'contacted', 'qualified', 'closed', 'archived'];

export default function BizLeads() {
  const [filter, setFilter] = useState<LeadStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [leads, setLeads] = useState<SmartCardLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadLeads();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExportMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? leads : leads.filter(lead => lead.status === filter)),
    [filter, leads],
  );
  const selectedCount = selectedIds.length;
  const activeLead = useMemo(
    () => leads.find(lead => lead.id === activeLeadId) ?? null,
    [activeLeadId, leads],
  );
  const allVisibleSelected = filtered.length > 0 && filtered.every(lead => selectedIds.includes(lead.id));

  async function loadLeads() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign in to view leads.');
      setLeads([]);
      setLoading(false);
      return;
    }

    const { data, error: leadsError } = await supabase
      .from('business_card_leads')
      .select(`
        id,
        name,
        email,
        phone,
        message,
        source,
        status,
        lead_type,
        metadata,
        created_at,
        updated_at,
        card:business_cards (
          business_name,
          slug
        )
      `)
      .order('created_at', { ascending: false });

    if (leadsError) {
      setError(leadsError.message);
      setLeads([]);
    } else {
      setLeads((data ?? []) as SmartCardLead[]);
    }

    setLoading(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(filtered.map(lead => lead.id));
      setSelectedIds(current => current.filter(id => !visibleIds.has(id)));
      return;
    }

    const next = new Set(selectedIds);
    filtered.forEach(lead => next.add(lead.id));
    setSelectedIds(Array.from(next));
  }

  async function updateLeadRecord(
    ids: string[],
    updates: Partial<Pick<SmartCardLead, 'status' | 'metadata' | 'updated_at'>>,
    successMessage: string,
    options?: { clearSelection?: boolean },
  ) {
    if (ids.length === 0 || updating) return false;

    setUpdating(true);
    setError(null);
    setActionMessage(null);

    const { data, error: updateError } = await supabase
      .from('business_card_leads')
      .update(updates)
      .in('id', ids)
      .select('id, status, metadata, updated_at');

    if (updateError) {
      setError(updateError.message);
      setUpdating(false);
      return false;
    }

    const patchMap = new Map((data ?? []).map(item => [item.id as string, item]));
    setLeads(current => current.map(lead => {
      const patch = patchMap.get(lead.id);
      return patch
        ? {
            ...lead,
            status: (patch.status as LeadManagerStatus | undefined) ?? lead.status,
            metadata: (patch.metadata as LeadMetadata | null | undefined) ?? lead.metadata,
            updated_at: typeof patch.updated_at === 'string' ? patch.updated_at : lead.updated_at,
          }
        : lead;
    }));

    if (options?.clearSelection !== false) {
      setSelectedIds(current => current.filter(id => !ids.includes(id)));
    }

    setActionMessage(successMessage);
    setUpdating(false);
    return true;
  }

  async function updateStatuses(ids: string[], status: LeadManagerStatus) {
    return updateLeadRecord(
      ids,
      { status },
      `${ids.length} lead${ids.length === 1 ? '' : 's'} updated to ${status}.`,
    );
  }

  async function saveLeadNotes(leadId: string, notes: string) {
    const lead = leads.find(item => item.id === leadId);
    if (!lead) return false;

    const metadata: LeadMetadata = {
      ...(lead.metadata ?? {}),
      notes,
    };

    return updateLeadRecord([leadId], { metadata }, 'Lead notes saved.', { clearSelection: false });
  }

  async function markLeadContactedNow(leadId: string) {
    const lead = leads.find(item => item.id === leadId);
    if (!lead) return false;

    const isoNow = new Date().toISOString();
    const metadata: LeadMetadata = {
      ...(lead.metadata ?? {}),
      last_contacted_at: isoNow,
    };

    return updateLeadRecord(
      [leadId],
      { status: 'contacted', metadata },
      'Lead marked as contacted.',
      { clearSelection: false },
    );
  }

  function buildLeadRows(items: SmartCardLead[]): LeadCsvRow[] {
    return items.map(lead => {
      const split = splitLeadName(lead.name);
      return {
        firstName: split.firstName,
        lastName: split.lastName,
        fullName: lead.name,
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        message: lead.message ?? '',
        source: formatLeadSource(lead),
        smartCard: lead.card?.business_name ?? '',
        status: lead.status,
        createdAt: new Date(lead.created_at).toISOString(),
        notes: getLeadNotes(lead.metadata),
        lastContactedAt: getLeadLastContactedAt(lead.metadata),
        leadType: formatLeadType(lead.lead_type),
        requestedService: getLeadRequestedService(lead.metadata),
        preferredDate: getLeadPreferredDate(lead.metadata),
        preferredTime: getLeadPreferredTime(lead.metadata),
      };
    });
  }

  function exportLeads(items: SmartCardLead[], label: string) {
    setExportMenuOpen(false);

    if (items.length === 0) {
      setActionMessage(`No ${label.toLowerCase()} to export.`);
      return;
    }

    const csv = buildCsv(buildLeadRows(items));
    downloadCsv(csv, createLeadCsvFilename());
    setActionMessage(`Exported ${items.length} ${label.toLowerCase()}.`);
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(successMessage);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }

  const selectedLeads = leads.filter(lead => selectedIds.includes(lead.id));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold">Lead Manager</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{leads.length} total leads collected through Adpadz Smart Cards.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen(current => !current)}
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              className="btn-secondary px-4 py-2.5 text-sm"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 min-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2 shadow-2xl">
                <button type="button" onClick={() => exportLeads(leads, 'All Leads')} className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]">
                  Export all leads
                </button>
                <button type="button" onClick={() => exportLeads(filtered, 'Filtered Leads')} className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]">
                  Export filtered leads
                </button>
                <button type="button" onClick={() => exportLeads(selectedLeads, 'Selected Leads')} className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]">
                  Export selected leads
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-surface mb-5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(item => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                  filter === item ? 'bg-neon text-black' : 'border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <button type="button" onClick={toggleSelectAllVisible} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 transition hover:border-[var(--border-neon)] hover:text-[var(--text-primary)]">
              {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5 text-neon" /> : <Square className="h-3.5 w-3.5" />}
              Select all visible
            </button>
            <span>{selectedCount} selected</span>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5">
              CRM handoff ready: CSV live, {LEAD_HANDOFF_TARGETS.slice(1).join(', ')} later
            </span>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="card-surface mb-5 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Bulk actions for {selectedCount} selected lead{selectedCount === 1 ? '' : 's'}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Update status, archive, or export your selected leads.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUS_OPTIONS.filter(option => option.value !== 'archived').map(option => (
              <button key={option.value} type="button" onClick={() => void updateStatuses(selectedIds, option.value)} disabled={updating} className="btn-secondary px-3 py-2 text-xs">
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => void updateStatuses(selectedIds, 'archived')} disabled={updating} className="btn-secondary px-3 py-2 text-xs">
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
            <button type="button" onClick={() => exportLeads(selectedLeads, 'Selected Leads')} className="btn-primary px-3 py-2 text-xs text-black">
              <Download className="h-3.5 w-3.5" /> Export selected
            </button>
          </div>
        </div>
      )}

      {(error || actionMessage) && (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-neon/30 bg-neon/10 text-neon'}`}>
          {error || actionMessage}
        </div>
      )}

      {loading ? (
        <div className="card-surface p-6 text-sm text-[var(--text-muted)]">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-6 text-sm text-[var(--text-muted)]">No leads yet. Smart Card requests will show up here automatically.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const selected = selectedIds.includes(lead.id);
            return (
              <div
                key={lead.id}
                onClick={() => setActiveLeadId(lead.id)}
                className={`card-surface cursor-pointer p-4 transition-all hover:border-[var(--border-neon)] ${selected ? 'border-[var(--border-neon)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        toggleSelected(lead.id);
                      }}
                      className="mt-0.5 text-[var(--text-muted)] transition hover:text-neon"
                      aria-label={selected ? `Deselect ${lead.name}` : `Select ${lead.name}`}
                    >
                      {selected ? <CheckSquare className="h-4.5 w-4.5 text-neon" /> : <Square className="h-4.5 w-4.5" />}
                    </button>
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neon/10 text-xs font-bold text-neon">
                      {lead.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{lead.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>From: {formatLeadSource(lead)}</span>
                        {lead.lead_type === 'booking_request' && <span className="badge badge-active text-[10px]">Booking Request</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        {lead.email && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                            <Mail className="h-3 w-3" /> {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </span>
                        )}
                      </div>
                      {(getLeadRequestedService(lead.metadata) || getLeadPreferredDate(lead.metadata) || getLeadPreferredTime(lead.metadata)) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                          {getLeadRequestedService(lead.metadata) && <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)]">Service: {getLeadRequestedService(lead.metadata)}</span>}
                          {getLeadPreferredDate(lead.metadata) && <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)]">Date: {getLeadPreferredDate(lead.metadata)}</span>}
                          {getLeadPreferredTime(lead.metadata) && <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)]">Time: {getLeadPreferredTime(lead.metadata)}</span>}
                        </div>
                      )}
                      {lead.message && (
                        <div className="mt-2 flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
                          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 flex-none" />
                          <p className="max-w-2xl leading-relaxed line-clamp-2">{lead.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <LeadBadge status={lead.status} />
                </div>
                <div className="mt-2 pl-16 text-[10px] text-[var(--text-muted)]">
                  {new Date(lead.created_at).toLocaleDateString()} at {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeLead && (
        <LeadDetailDrawer
          lead={activeLead}
          onClose={() => setActiveLeadId(null)}
          onCopy={copyText}
          onExport={lead => exportLeads([lead], 'Lead')}
          onStatusChange={status => void updateStatuses([activeLead.id], status)}
          onSaveNotes={saveLeadNotes}
          onMarkContactedNow={markLeadContactedNow}
          updating={updating}
        />
      )}
    </div>
  );
}

function LeadDetailDrawer({
  lead,
  onClose,
  onCopy,
  onExport,
  onStatusChange,
  onSaveNotes,
  onMarkContactedNow,
  updating,
}: {
  lead: SmartCardLead;
  onClose: () => void;
  onCopy: (value: string, successMessage: string) => Promise<void>;
  onExport: (lead: SmartCardLead) => void;
  onStatusChange: (status: LeadManagerStatus) => void;
  onSaveNotes: (leadId: string, notes: string) => Promise<boolean>;
  onMarkContactedNow: (leadId: string) => Promise<boolean>;
  updating: boolean;
}) {
  const [notesDraft, setNotesDraft] = useState(getLeadNotes(lead.metadata));
  const [noteState, setNoteState] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [markingContacted, setMarkingContacted] = useState(false);

  useEffect(() => {
    setNotesDraft(getLeadNotes(lead.metadata));
    setNoteState(null);
    setSavingNotes(false);
    setMarkingContacted(false);
  }, [lead.id, lead.metadata]);

  const notes = getLeadNotes(lead.metadata);
  const lastContactedAt = getLeadLastContactedAt(lead.metadata);
  const requestedService = getLeadRequestedService(lead.metadata);
  const preferredDate = getLeadPreferredDate(lead.metadata);
  const preferredTime = getLeadPreferredTime(lead.metadata);
  const createdAt = `${new Date(lead.created_at).toLocaleDateString()} at ${new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const leadSource = formatLeadSource(lead);
  const fullCopy = formatLeadCopyBlock({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: leadSource,
    message: lead.message,
    createdAt,
    leadType: formatLeadType(lead.lead_type),
    requestedService,
    preferredDate,
    preferredTime,
  });

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNoteState(null);
    const success = await onSaveNotes(lead.id, notesDraft.trim());
    setSavingNotes(false);
    setNoteState(success
      ? { type: 'success', message: 'Notes saved.' }
      : { type: 'error', message: 'Could not save notes.' });
  }

  async function handleMarkContactedNow() {
    setMarkingContacted(true);
    setNoteState(null);
    const success = await onMarkContactedNow(lead.id);
    setMarkingContacted(false);
    setNoteState(success
      ? { type: 'success', message: 'Lead marked contacted and timestamped.' }
      : { type: 'error', message: 'Could not update contacted date.' });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm">
      <button type="button" onClick={onClose} className="flex-1" aria-label="Close lead details" />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border-default)] bg-[var(--bg-base)] p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-xl border border-[var(--border-subtle)] p-2 text-[var(--text-muted)] transition hover:border-[var(--border-neon)] hover:text-[var(--text-primary)]">
          <X className="h-4 w-4" />
        </button>

        <div className="pr-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neon">Lead detail</p>
          <h2 className="mt-2 text-2xl font-black">{lead.name}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{leadSource}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="btn-secondary px-3 py-2 text-xs">
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="btn-secondary px-3 py-2 text-xs">
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
          )}
          <button type="button" onClick={() => void onCopy(fullCopy, 'Lead info copied.')} className="btn-secondary px-3 py-2 text-xs">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button type="button" onClick={() => onExport(lead)} className="btn-primary px-3 py-2 text-xs text-black">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <LeadMetaCard label="Email" value={lead.email || 'Not provided'} />
          <LeadMetaCard label="Phone" value={lead.phone || 'Not provided'} />
          <LeadMetaCard label="Smart Card" value={lead.card?.business_name || 'Unknown'} />
          <LeadMetaCard label="Created At" value={createdAt} />
          <LeadMetaCard label="Status" value={lead.status} />
          <LeadMetaCard label="Lead Type" value={formatLeadType(lead.lead_type)} />
          <LeadMetaCard label="Requested Service" value={requestedService || 'General booking request'} />
          <LeadMetaCard label="Preferred Date" value={preferredDate || 'Not provided'} />
          <LeadMetaCard label="Preferred Time" value={preferredTime || 'Not provided'} />
          <LeadMetaCard label="Last Contacted" value={lastContactedAt ? formatMetaDate(lastContactedAt) : 'Not yet contacted'} />
          <LeadMetaCard label="Notes" value={notes ? 'Saved in CRM handoff' : 'No notes yet'} />
        </div>

        <section className="card-surface mt-5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Message</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Lead context from the Smart Card form, booking request, or QR journey.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleMarkContactedNow()}
              disabled={markingContacted || updating}
              className="btn-secondary px-3 py-2 text-xs"
            >
              {markingContacted ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
              Mark contacted now
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{lead.message || 'No message provided.'}</p>
        </section>

        <section className="card-surface mt-5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Keep CRM handoff notes, next steps, and context here.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes || updating}
              className="btn-primary px-3 py-2 text-xs text-black"
            >
              {savingNotes ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Notes
            </button>
          </div>
          <textarea
            value={notesDraft}
            onChange={event => setNotesDraft(event.target.value)}
            rows={6}
            placeholder="Add follow-up notes, sales context, preferred timing, or handoff details..."
            className="mt-3 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--border-neon)]"
          />
          {noteState && (
            <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${noteState.type === 'success' ? 'border-neon/30 bg-neon/10 text-neon' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
              {noteState.message}
            </div>
          )}
        </section>

        <section className="card-surface mt-5 p-4">
          <h3 className="text-sm font-semibold">Status</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {LEAD_STATUS_OPTIONS.map(option => (
              <button key={option.value} type="button" onClick={() => onStatusChange(option.value)} disabled={updating} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${lead.status === option.value ? 'bg-neon text-black' : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-neon)] hover:text-[var(--text-primary)]'}`}>
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function LeadMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function formatLeadSource(lead: SmartCardLead): string {
  const cardName = lead.card?.business_name?.trim();
  const sourceLabel = formatLeadSourceLabel(lead.source);
  return cardName ? `${sourceLabel} - ${cardName}` : sourceLabel;
}

function formatLeadType(value: string): string {
  if (value === 'booking_request') return 'Booking Request';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatMetaDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function LeadBadge({ status }: { status: SmartCardLead['status'] }) {
  const colors: Record<SmartCardLead['status'], string> = {
    new: 'bg-blue-400/10 text-blue-400',
    contacted: 'bg-yellow-400/10 text-yellow-400',
    qualified: 'bg-neon/10 text-neon',
    closed: 'bg-green-400/10 text-green-400',
    archived: 'bg-red-400/10 text-red-400',
  };

  return <span className={`badge text-[10px] capitalize ${colors[status]}`}>{status}</span>;
}











