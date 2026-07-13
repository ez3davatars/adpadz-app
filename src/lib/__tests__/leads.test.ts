import { describe, expect, it } from 'vitest';
import {
  buildCsv,
  createLeadCsvFilename,
  escapeCsvCell,
  formatLeadCopyBlock,
  formatLeadSourceLabel,
  getLeadLastContactedAt,
  getLeadNotes,
  getLeadPreferredDate,
  getLeadPreferredTime,
  getLeadRequestedService,
  splitLeadName,
  type LeadCsvRow,
} from '../leads';

describe('lead name and CSV helpers', () => {
  it('normalizes whitespace and preserves compound last names', () => {
    expect(splitLeadName('  Ada   Byron Lovelace  ')).toEqual({
      firstName: 'Ada',
      lastName: 'Byron Lovelace',
    });
    expect(splitLeadName('Prince')).toEqual({ firstName: 'Prince', lastName: '' });
    expect(splitLeadName('   ')).toEqual({ firstName: '', lastName: '' });
  });

  it('escapes quotes, commas, and line endings according to CSV rules', () => {
    expect(escapeCsvCell('plain text')).toBe('plain text');
    expect(escapeCsvCell('Hello, "team"\r\nNext')).toBe('"Hello, ""team""\nNext"');
  });

  it('builds a stable export with the expected column order', () => {
    const row: LeadCsvRow = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0100',
      message: 'Please call',
      source: 'smart_card_public',
      smartCard: 'Main card',
      status: 'new',
      createdAt: '2026-07-10T12:00:00Z',
      notes: '',
      lastContactedAt: '',
      leadType: 'inquiry',
      requestedService: 'Consultation',
      preferredDate: '2026-07-15',
      preferredTime: '10:00',
    };

    const [header, data] = buildCsv([row]).split('\n');
    expect(header).toBe('First Name,Last Name,Full Name,Email,Phone,Message,Source,Smart Card,Status,Created At,Notes,Last Contacted At,Lead Type,Requested Service,Preferred Date,Preferred Time');
    expect(data).toBe('Ada,Lovelace,Ada Lovelace,ada@example.com,555-0100,Please call,smart_card_public,Main card,new,2026-07-10T12:00:00Z,,,inquiry,Consultation,2026-07-15,10:00');
  });

  it('creates date-stamped filenames', () => {
    expect(createLeadCsvFilename(new Date(2026, 6, 10, 12))).toBe('adpadz-leads-2026-07-10.csv');
  });
});

describe('lead presentation helpers', () => {
  it('formats a copy block and omits unavailable optional booking fields', () => {
    expect(formatLeadCopyBlock({
      name: 'Sam Rivera',
      email: null,
      source: 'QR Scan',
      message: null,
      createdAt: 'Jul 10, 2026',
    })).toBe([
      'Name: Sam Rivera',
      'Email: ',
      'Phone: ',
      'Source: QR Scan',
      'Message: ',
      'Date: Jul 10, 2026',
    ].join('\n'));
  });

  it('reads only string values from untrusted metadata', () => {
    const metadata = {
      notes: 'Follow up',
      last_contacted_at: '2026-07-10T13:00:00Z',
      service_name: 'Repair',
      preferred_date: '2026-07-12',
      preferred_time: '14:30',
    };

    expect(getLeadNotes(metadata)).toBe('Follow up');
    expect(getLeadLastContactedAt(metadata)).toBe('2026-07-10T13:00:00Z');
    expect(getLeadRequestedService(metadata)).toBe('Repair');
    expect(getLeadPreferredDate(metadata)).toBe('2026-07-12');
    expect(getLeadPreferredTime(metadata)).toBe('14:30');
    expect(getLeadNotes({ notes: 42 })).toBe('');
    expect(getLeadNotes(null)).toBe('');
  });

  it('maps known sources and humanizes unknown source keys', () => {
    expect(formatLeadSourceLabel('smart_card_booking')).toBe('Booking Request');
    expect(formatLeadSourceLabel('partner_referral')).toBe('Partner Referral');
  });
});
