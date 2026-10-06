/* NOOR · a stand-in for Stripe, read only, for the giving tests.
   ---------------------------------------------------------------------------
   3 October 2026 (LANTERN.md section 9). Handed to api/_giving.js through its
   own seam (setGivingSeams({fetchImpl})), never the network. It answers the
   two reads the house makes (charges, page by page, and subscriptions) and
   records every call, so a test can prove the house only ever reads: any
   method but GET is answered 405 and kept in `writes`. Each gift carries a
   name, an email and a du'a the way Stripe's own answer does, so a test can
   prove none of them ever leaves the reading. */

export function stripeStub() {
  const state = { charges: [], subs: [], calls: [], writes: [], fail: null };
  const json = (code, body) => ({ ok: code >= 200 && code < 300, status: code, json: async () => body });
  let n = 0;
  const F = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    state.calls.push({ url: String(url), method });
    if (method !== 'GET') { state.writes.push({ url: String(url), method }); return json(405, { error: { message: 'the stub only reads' } }); }
    if (state.fail) return json(state.fail, { error: { message: 'the stub refused' } });
    const u = new URL(url);
    const lim = parseInt(u.searchParams.get('limit'), 10) || 10;
    const after = u.searchParams.get('starting_after');
    const page = list => {
      let l = list;
      if (after) { const i = l.findIndex(x => x.id === after); l = i === -1 ? [] : l.slice(i + 1); }
      return json(200, { object: 'list', data: l.slice(0, lim), has_more: l.length > lim });
    };
    if (u.pathname === '/v1/charges') {
      const gte = parseInt(u.searchParams.get('created[gte]'), 10) || 0;
      const lte = parseInt(u.searchParams.get('created[lte]'), 10) || Infinity;
      return page(state.charges.filter(c => c.created >= gte && c.created <= lte).sort((a, b) => b.created - a.created));
    }
    if (u.pathname === '/v1/subscriptions') {
      const st = u.searchParams.get('status');
      return page(state.subs.filter(s => !st || st === 'all' || s.status === st));
    }
    return json(404, { error: { message: 'no such stub path' } });
  };
  /* a gift on a day (YYYY-MM-DD, at noon UTC), in minor units */
  const gift = (date, amountMinor, o = {}) => {
    n++;
    state.charges.push({
      id: 'ch_' + n, object: 'charge', status: 'succeeded', paid: true, amount: amountMinor, amount_captured: amountMinor,
      amount_refunded: o.refunded || 0, currency: o.currency || 'usd', created: Math.floor(Date.parse(date + 'T12:00:00Z') / 1000),
      balance_transaction: { currency: o.currency || 'usd', fee: o.fee == null ? Math.round(amountMinor * 0.059) : o.fee },
      metadata: { noor_donation: '1', noor_dua: 'May Allah accept it from my mother' },
      billing_details: { email: 'giver' + n + '@example.org', name: 'A Giver ' + n }
    });
  };
  /* the active monthly givers, n of them (and one that is not a gift) */
  const givers = count => {
    state.subs = Array.from({ length: count }, (_, i) => ({ id: 'sub_' + i, object: 'subscription', status: 'active', metadata: { noor_donation: '1' },
      customer: { email: 'monthly' + i + '@example.org', name: 'A Monthly Giver ' + i } }));
    state.subs.push({ id: 'sub_guardian', object: 'subscription', status: 'active', metadata: { noor_market: 'uk' }, customer: { email: 'guardian@example.org' } });
    state.subs.push({ id: 'sub_old', object: 'subscription', status: 'canceled', metadata: { noor_donation: '1' } });
  };
  return { F, state, gift, givers };
}
