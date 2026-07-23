/**
 * Regression harness for the Thumbtack event processor's new-lead side effects.
 * Run with `npm test`. No DB, no network: processThumbtackEvent takes injectable
 * deps (a Supabase client + the alert/auto-reply/thread functions), so here we
 * pass an in-memory fake Supabase and spies and replay real event sequences.
 *
 * This is the class of test that was MISSING when the auto-reply silently
 * skipped a live lead: the bug only appears when MessageCreatedV4 reaches the
 * processor before NegotiationCreatedV4 (the message pre-creates the lead), and
 * no pure-function test can see that. These pin the ordering contract:
 *   - the alert + auto-reply fire exactly once per negotiation, in EITHER order
 *   - redeliveries never re-fire
 *   - a failed/disabled auto-reply is retried on the next delivery
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { processThumbtackEvent, type ProcessThumbtackDeps } from './thumbtackProcessor';
import type { AutoReplyResult } from './thumbtackAutoReply';

const NEGOTIATION_ID = '585635485432135684';

const negotiationEvent = {
  event: { eventType: 'NegotiationCreatedV4' },
  data: {
    negotiationID: NEGOTIATION_ID,
    business: { businessID: '553306875926847497' },
    customer: { firstName: 'David', lastName: 'Laurie', phone: '4055551234' },
    // No estimate/leadPrice on purpose -> createLeadExpense short-circuits at
    // skipped_no_price and never touches the expenses/clients tables.
    request: { category: { name: 'Web Design' }, description: 'Need a website' },
  },
};

const messageEvent = {
  event: { eventType: 'MessageCreatedV4' },
  data: {
    negotiationID: NEGOTIATION_ID,
    messageID: 'msg-1',
    from: 'Customer',
    text: 'Need Facebook group page revamped',
    business: { businessID: '553306875926847497', displayName: 'NunezDev' },
    customer: { customerID: 'cust-1', displayName: 'David Laurie' },
  },
};

// --- Minimal in-memory Supabase supporting only what the processor calls ----
type Row = Record<string, unknown>;
interface QueryResult {
  data: unknown;
  error: unknown;
}
// Chainable, awaitable query builder (thenable) — just the methods the
// processor uses.
interface QB extends PromiseLike<QueryResult> {
  select(): QB;
  insert(v: unknown): QB;
  update(v: unknown): QB;
  eq(c: unknown, v: unknown): QB;
  ilike(c: unknown, v: unknown): QB;
  not(...a: unknown[]): QB;
  order(): QB;
  limit(): QB;
  single(): QB;
}

function makeFakeSupabase() {
  const tables: Record<string, Row[]> = { leads: [], thumbtack_events: [] };
  let seq = 1;

  const like = (v: unknown, pat: string) =>
    String(v ?? '').toLowerCase().includes(pat.replace(/%/g, '').toLowerCase());

  function from(table: string) {
    tables[table] ??= [];
    const state = { table, op: 'select' as 'select' | 'insert' | 'update', payload: null as unknown, filters: [] as unknown[][], single: false };
    const run = (): QueryResult => {
      const rows = tables[state.table];
      const match = (r: Row) =>
        state.filters.every((f) => {
          if (f[0] === 'eq') return r[f[1] as string] === f[2];
          if (f[0] === 'ilike') return like(r[f[1] as string], f[2] as string);
          return true; // `not`, etc. — irrelevant to these tests
        });
      if (state.op === 'insert') {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = (list as Row[]).map((r) => ({ id: `id_${seq++}`, ...r }));
        rows.push(...inserted);
        return { data: state.single ? inserted[0] : inserted, error: null };
      }
      if (state.op === 'update') {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, state.payload));
        return { data: hit, error: null };
      }
      const found = rows.filter(match);
      return state.single
        ? { data: found[0] ?? null, error: found[0] ? null : { message: 'not found' } }
        : { data: found, error: null };
    };
    const b: QB = {
      select: () => b,
      insert: (v) => ((state.op = 'insert'), (state.payload = v), b),
      update: (v) => ((state.op = 'update'), (state.payload = v), b),
      eq: (c, v) => (state.filters.push(['eq', c, v]), b),
      ilike: (c, v) => (state.filters.push(['ilike', c, v]), b),
      not: (...a) => (state.filters.push(['not', ...a]), b),
      order: () => b,
      limit: () => b,
      single: () => ((state.single = true), b),
      then: (onfulfilled, onrejected) => Promise.resolve(run()).then(onfulfilled, onrejected),
    };
    return b;
  }
  return { from, _tables: tables };
}

// --- test rig --------------------------------------------------------------
function setup() {
  const fake = makeFakeSupabase();
  const calls = { alert: 0, autoReply: 0, thread: 0 };
  let autoReplyQueue: AutoReplyResult[] = [];

  const deps: ProcessThumbtackDeps = {
    supabase: fake as unknown as ProcessThumbtackDeps['supabase'],
    alert: async () => {
      calls.alert += 1;
    },
    autoReply: async () => {
      calls.autoReply += 1;
      return autoReplyQueue.shift() ?? ({ status: 'sent' } as AutoReplyResult);
    },
    thread: async () => {
      calls.thread += 1;
      return { status: 'message_threaded' as const };
    },
  };

  return {
    deps,
    calls,
    tables: fake._tables,
    setAutoReplyResults: (r: AutoReplyResult[]) => {
      autoReplyQueue = r;
    },
  };
}

describe('processThumbtackEvent — new-lead side effects fire once per negotiation', () => {
  let rig: ReturnType<typeof setup>;
  beforeEach(() => {
    rig = setup();
  });

  it('fires alert + auto-reply when the MESSAGE arrives before the negotiation (the regression)', async () => {
    // Message first — this pre-creates the lead, which used to make `created`
    // false on the negotiation event and skip both side effects.
    await processThumbtackEvent({ id: 'm1', payload: messageEvent }, rig.deps);
    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);

    assert.equal(rig.calls.thread, 1, 'message threaded once');
    assert.equal(rig.calls.alert, 1, 'owner alert fired once');
    assert.equal(rig.calls.autoReply, 1, 'auto-reply fired once');

    // Redelivery of the negotiation must not re-fire.
    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.alert, 1, 'no duplicate alert on redelivery');
    assert.equal(rig.calls.autoReply, 1, 'no duplicate auto-reply on redelivery');
  });

  it('fires alert + auto-reply when the NEGOTIATION arrives first', async () => {
    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    await processThumbtackEvent({ id: 'm1', payload: messageEvent }, rig.deps);

    assert.equal(rig.calls.alert, 1);
    assert.equal(rig.calls.autoReply, 1);
    assert.equal(rig.calls.thread, 1);
  });

  it('retries the auto-reply on the next delivery when a send fails (marker only stamped on success)', async () => {
    rig.setAutoReplyResults([{ status: 'error', detail: 'boom' }, { status: 'sent' }]);

    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.autoReply, 1, 'attempted');
    assert.equal(rig.calls.alert, 1, 'alert still fired (independent marker)');

    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.autoReply, 2, 'retried after the failure');

    // Now it succeeded -> marker stamped -> no further attempts.
    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.autoReply, 2, 'no retry once sent');
    assert.equal(rig.calls.alert, 1, 'alert never re-fired');
  });

  it('retries the auto-reply after it was disabled (flag off -> on), without re-alerting', async () => {
    rig.setAutoReplyResults([{ status: 'disabled' }, { status: 'sent' }]);

    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.autoReply, 1);
    assert.equal(rig.calls.alert, 1);

    await processThumbtackEvent({ id: 'n1', payload: negotiationEvent }, rig.deps);
    assert.equal(rig.calls.autoReply, 2, 'disabled did not stamp the marker, so it retried');
    assert.equal(rig.calls.alert, 1, 'alert not repeated');
  });
});
