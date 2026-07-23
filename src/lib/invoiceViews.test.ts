/**
 * Unit tests for invoice view-tracking logic. Run with `npm test`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoiceViewUpdate,
  formatInvoiceViewedSummary,
  VIEW_DEBOUNCE_MS,
} from './invoiceViews';

describe('computeInvoiceViewUpdate', () => {
  const never = { viewed_at: null, last_viewed_at: null, view_count: 0 };

  it('stamps viewed_at + last_viewed_at + count=1 on the first ever view', () => {
    const u = computeInvoiceViewUpdate(never, '2026-07-22T10:00:00.000Z');
    assert.deepEqual(u, {
      viewed_at: '2026-07-22T10:00:00.000Z',
      last_viewed_at: '2026-07-22T10:00:00.000Z',
      view_count: 1,
    });
  });

  it('does NOT move viewed_at on later views, only last_viewed_at + count', () => {
    const current = {
      viewed_at: '2026-07-20T10:00:00.000Z',
      last_viewed_at: '2026-07-20T10:00:00.000Z',
      view_count: 1,
    };
    const u = computeInvoiceViewUpdate(current, '2026-07-22T15:00:00.000Z');
    assert.equal(u?.viewed_at, undefined); // first-view stamp untouched
    assert.equal(u?.last_viewed_at, '2026-07-22T15:00:00.000Z');
    assert.equal(u?.view_count, 2);
  });

  it('debounces duplicate hits within the window (returns null, no double count)', () => {
    const current = {
      viewed_at: '2026-07-22T10:00:00.000Z',
      last_viewed_at: '2026-07-22T10:00:00.000Z',
      view_count: 1,
    };
    // 5s later — inside the 30s debounce window
    assert.equal(computeInvoiceViewUpdate(current, '2026-07-22T10:00:05.000Z'), null);
  });

  it('counts again once the debounce window passes', () => {
    const current = {
      viewed_at: '2026-07-22T10:00:00.000Z',
      last_viewed_at: '2026-07-22T10:00:00.000Z',
      view_count: 1,
    };
    const later = new Date(Date.parse('2026-07-22T10:00:00.000Z') + VIEW_DEBOUNCE_MS + 1).toISOString();
    const u = computeInvoiceViewUpdate(current, later);
    assert.equal(u?.view_count, 2);
  });

  it('treats a null view_count as 0', () => {
    const u = computeInvoiceViewUpdate(
      { viewed_at: null, last_viewed_at: null, view_count: null },
      '2026-07-22T10:00:00.000Z'
    );
    assert.equal(u?.view_count, 1);
  });
});

describe('formatInvoiceViewedSummary', () => {
  it('reports not-yet-viewed', () => {
    assert.equal(
      formatInvoiceViewedSummary({ viewed_at: null, last_viewed_at: null, view_count: 0 }),
      'Not yet viewed'
    );
  });

  it('singular vs plural view counts', () => {
    assert.match(
      formatInvoiceViewedSummary({
        viewed_at: '2026-07-22T10:00:00.000Z',
        last_viewed_at: '2026-07-22T10:00:00.000Z',
        view_count: 1,
      }),
      /^Viewed once · last /
    );
    assert.match(
      formatInvoiceViewedSummary({
        viewed_at: '2026-07-22T10:00:00.000Z',
        last_viewed_at: '2026-07-22T12:00:00.000Z',
        view_count: 4,
      }),
      /^Viewed 4× · last /
    );
  });
});
