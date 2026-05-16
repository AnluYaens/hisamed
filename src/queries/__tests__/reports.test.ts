import { beforeEach, describe, expect, it, vi } from 'vitest';

// `getClinicReport` issues 14 clinic-scoped sub-queries in a fixed order
// inside a single `Promise.all`. The mock below hands each freshly created
// query builder the next canned result set from `queue`, so a test can drive
// every branch of the aggregation without a real database.
const queue: unknown[][] = [];

function makeBuilder() {
  const result = queue.shift() ?? [];
  const builder: Record<string, unknown> = {};
  for (const m of [
    'from',
    'where',
    'groupBy',
    'innerJoin',
    'leftJoin',
    'orderBy',
    'limit',
  ]) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return builder;
}

vi.mock('@/lib/db', () => ({
  db: { select: () => makeBuilder() },
}));

import { getClinicReport } from '../reports';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const FILTERS = { from: '2026-04-16', to: '2026-05-15', today: '2026-05-15' };

beforeEach(() => {
  queue.length = 0;
});

describe('getClinicReport — empty data', () => {
  it('returns safe zero values when every query is empty', async () => {
    // All 14 sub-queries resolve to [] (the default).
    const report = await getClinicReport(CLINIC_ID, 'America/Caracas', FILTERS);

    expect(report.hasData).toBe(false);
    expect(report.activity.totalPatients).toBe(0);
    expect(report.activity.totalAppointments).toBe(0);
    expect(report.activity.notesCreated).toBe(0);
    expect(report.activity.appointmentsByStatus.completed).toBe(0);
    expect(report.documents.totalDocuments).toBe(0);
    expect(report.documents.historyPdfExports).toBe(0);
    expect(report.attachments.totalAttachments).toBe(0);
    expect(report.attachments.totalStorageMb).toBe(0);
    expect(report.obstetric.activePregnancies).toBe(0);
    expect(report.recentExports).toEqual([]);
    expect(report.recentActivity).toEqual([]);
    expect(report.range).toEqual({ from: FILTERS.from, to: FILTERS.to });
  });
});

describe('getClinicReport — aggregation', () => {
  it('aggregates counts, statuses and storage correctly', async () => {
    queue.push(
      [{ cnt: '120' }], // total patients
      [{ cnt: '8' }], // new patients
      [
        { status: 'completed', cnt: '30' },
        { status: 'cancelled', cnt: '5' },
        { status: 'no_show', cnt: '2' },
      ], // appointments by status
      [
        { isSigned: true, cnt: '18' },
        { isSigned: false, cnt: '4' },
      ], // notes
      [
        { documentType: 'prescription', cnt: '12' },
        { documentType: 'referral', cnt: '3' },
      ], // documents by type
      [{ cnt: '7' }], // pdf exports
      [
        { status: 'sent', cnt: '5' },
        { status: 'attempted', cnt: '6' },
        { status: 'failed', cnt: '1' },
      ], // email exports by status
      [
        { category: 'ultrasound', cnt: '10', bytes: String(2 * 1024 * 1024) },
        { category: 'procedure_photo', cnt: '4', bytes: String(1024 * 1024) },
      ], // attachments by category
      [
        { lmp: '2026-04-01' }, // active — FUM within 42 weeks
        { lmp: '2026-03-20' }, // active
        { lmp: '2024-01-01' }, // stale — FUM older than 42 weeks
      ], // pregnancies
      [{ ultrasound: '11', exam: '6' }], // specialty notes
      [
        {
          id: 'e1',
          createdAt: new Date('2026-05-10T12:00:00Z'),
          userFullName: 'Dra. X',
          action: 'EXPORT',
          resourceType: 'patient_history',
          resourceId: 'p1',
          status: null,
        },
      ], // recent exports
      [
        {
          id: 'n1',
          occurredAt: new Date('2026-05-12T10:00:00Z'),
          firstName: 'Ana',
          lastName: 'Pérez',
          doctorName: 'Dra. X',
        },
      ], // recent notes
      [
        {
          id: 'd1',
          occurredAt: new Date('2026-05-13T10:00:00Z'),
          firstName: 'Bea',
          lastName: 'Gómez',
          doctorName: 'Dra. Y',
        },
      ], // recent documents
      [
        {
          id: 'a1',
          occurredAt: new Date('2026-05-11T10:00:00Z'),
          firstName: 'Cleo',
          lastName: 'Ruiz',
          doctorName: 'Dra. Z',
        },
      ], // recent attachments
    );

    const report = await getClinicReport(CLINIC_ID, 'America/Caracas', FILTERS);

    expect(report.hasData).toBe(true);

    expect(report.activity.totalPatients).toBe(120);
    expect(report.activity.newPatients).toBe(8);
    expect(report.activity.totalAppointments).toBe(37);
    expect(report.activity.appointmentsByStatus.completed).toBe(30);
    expect(report.activity.appointmentsByStatus.cancelled).toBe(5);
    expect(report.activity.appointmentsByStatus.no_show).toBe(2);
    expect(report.activity.appointmentsByStatus.scheduled).toBe(0);
    expect(report.activity.notesCreated).toBe(22);
    expect(report.activity.notesSigned).toBe(18);
    expect(report.activity.notesDraft).toBe(4);

    expect(report.documents.totalDocuments).toBe(15);
    expect(report.documents.byType.prescription).toBe(12);
    expect(report.documents.byType.referral).toBe(3);
    expect(report.documents.byType.lab_order).toBe(0);
    expect(report.documents.historyPdfExports).toBe(7);
    expect(report.documents.historyEmailExportsSent).toBe(5);
    expect(report.documents.historyEmailExportsAttempted).toBe(6);

    expect(report.attachments.totalAttachments).toBe(14);
    expect(report.attachments.ultrasoundCount).toBe(10);
    expect(report.attachments.procedurePhotoCount).toBe(4);
    expect(report.attachments.totalStorageMb).toBe(3);

    expect(report.obstetric.activePregnancies).toBe(2);
    expect(report.obstetric.staleFumWarnings).toBe(1);
    expect(report.obstetric.ultrasoundNotes).toBe(11);
    expect(report.obstetric.gynecologicalExamNotes).toBe(6);

    expect(report.recentExports).toHaveLength(1);
    // Merged note/document/attachment activity is sorted newest-first.
    expect(report.recentActivity.map((r) => r.id)).toEqual(['d1', 'n1', 'a1']);
    expect(report.recentActivity[0]).toMatchObject({
      type: 'document',
      patientName: 'Bea Gómez',
    });
  });
});

describe('getClinicReport — malformed obstetric data', () => {
  it('ignores impossible / malformed FUM dates without crashing', async () => {
    // Positions 1-8 resolve to []; position 9 is the pregnancy result set;
    // positions 10-14 default to [].
    for (let i = 0; i < 8; i += 1) queue.push([]);
    queue.push([
      { lmp: '2026-02-30' }, // regex-shaped but impossible (Feb has no 30th)
      { lmp: '2026-13-01' }, // impossible month
      { lmp: 'not-a-date' }, // garbage
      { lmp: null }, // missing
      { lmp: '2026-04-10' }, // the one genuinely valid, active FUM
    ]);

    // Must not throw — the previous SQL `::date` cast would have crashed here.
    const report = await getClinicReport(CLINIC_ID, 'America/Caracas', FILTERS);

    // Only the valid FUM is classified; every malformed value is skipped.
    expect(report.obstetric.activePregnancies).toBe(1);
    expect(report.obstetric.staleFumWarnings).toBe(0);
  });
});
