/**
 * End-to-end walk through the whole API, as a landlord would use it:
 * sign up, add a property, start a tenancy, bill it, part-pay it, hand it to
 * the spouse, and read the ledger back.
 */
const API = 'http://localhost:4000/api/v1';

let token = null;
const results = [];

async function call(method, path, body, { expect = null, as = token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { Authorization: `Bearer ${as}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (expect !== null) {
    const ok = res.status === expect;
    results.push({ ok, label: `${method} ${path}`, got: res.status, want: expect });
    if (!ok) console.log(`  FAIL ${method} ${path} -> ${res.status} (want ${expect})`,
      typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : data);
  }
  return { status: res.status, data };
}

const stamp = Date.now();
const email = `walk${stamp}@rentflow.test`;

console.log('\n── account ──');
const reg = await call('POST', '/auth/register', {
  email, password: 'rentflow-dev-1', name: 'Walkthrough Owner',
}, { expect: 201, as: null });
token = reg.data.accessToken;

await call('PATCH', '/me', { electricityRate: '10.00', company: 'Walk Estates' }, { expect: 200 });

console.log('\n── property ──');
const prop = await call('POST', '/properties', {
  name: 'Lakeview Residency', locality: 'Indiranagar, Bangalore',
  address: '9, 100 Feet Road, Indiranagar', kind: 'residential',
}, { expect: 201 });

const floor = await call('POST', `/properties/${prop.data.id}/floors`, {
  level: 0, name: 'Ground Floor',
}, { expect: 201 });

const unit = await call('POST', `/properties/${prop.data.id}/units`, {
  floorId: floor.data.id, number: '101',
  defaultRent: '18000.00', defaultDeposit: '54000.00',
}, { expect: 201 });

console.log('\n── tenancy, with a household ──');
const lease = await call('POST', '/leases', {
  unitId: unit.data.id,
  primaryPerson: {
    fullName: 'Arjun Mehta', phone: '+91 98765 43210',
    email: 'arjun@example.com', occupation: 'Software Engineer',
    dateOfBirth: '1992-04-18', idKind: 'aadhaar', idNumber: '2345 6789 0123',
  },
  termStart: '2026-05-01', termEnd: '2027-04-30',
  rent: '18000.00', deposit: '54000.00', dueDay: 5,
  members: [
    { person: { fullName: 'Priya Mehta', occupation: 'Architect' }, relation: 'wife' },
    { person: { fullName: 'Aarav Mehta', dateOfBirth: '2021-06-30' }, relation: 'son' },
  ],
}, { expect: 201 });
const leaseId = lease.data.id;
console.log('  occupants:', lease.data.occupants
  .map((o) => `${o.person.fullName} (${o.role}${o.relation ? '/' + o.relation : ''})`).join(', '));

console.log('\n── the unit now reads as occupied ──');
const units = await call('GET', '/units', null, { expect: 200 });
console.log('  ', units.data.map((u) => `${u.number} [${u.status}]`).join(', '));

console.log('\n── constraint: the same unit cannot be let again over those dates ──');
await call('POST', '/leases', {
  unitId: unit.data.id,
  primaryPerson: { fullName: 'Someone Else' },
  termStart: '2026-08-01', termEnd: '2027-01-01', rent: '18000.00',
}, { expect: 409 });

console.log('\n── meter readings ──');
for (const [readOn, reading] of [
  ['2026-04-01', '4820'], ['2026-05-01', '4882'],
  ['2026-06-01', '4953'], ['2026-07-01', '5008'],
]) {
  await call('POST', `/units/${unit.data.id}/readings`, { readOn, reading }, { expect: 201 });
}
console.log('  a reading below the last one is refused:');
await call('POST', `/units/${unit.data.id}/readings`,
  { readOn: '2026-08-01', reading: '4000' }, { expect: 400 });

const prev = await call('GET',
  `/units/${unit.data.id}/readings/previous?before=2026-06-01`, null, { expect: 200 });
console.log('  June opens from', prev.data.reading, 'taken', prev.data.readOn);

console.log('\n── bills ──');
const bill = (period, previous, current) => call('POST', '/bills', {
  leaseId, period,
  lines: [
    { kind: 'rent', amount: '18000.00' },
    { kind: 'electricity', electricityMode: 'meter',
      meterPrevious: previous, meterCurrent: current, unitRate: '10.00' },
  ],
}, { expect: 201 });

const may = await bill('2026-05', '4820', '4882');
console.log('  May total:',
  may.data.lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2),
  '(rent 18000 + 62 units x 10)');
await bill('2026-06', '4882', '4953');
await bill('2026-07', '4953', '5008');

console.log('\n── payments: May in full, June short by 800, July untouched ──');
await call('POST', '/payments', {
  leaseId, period: '2026-05', amount: '18620.00', paidOn: '2026-05-03', method: 'bank_transfer',
}, { expect: 201 });
await call('POST', '/payments', {
  leaseId, period: '2026-06', amount: '17910.00', paidOn: '2026-06-04', method: 'upi',
}, { expect: 201 });

console.log('\n── ledger ──');
const ledger = await call('GET', `/leases/${leaseId}/ledger`, null, { expect: 200 });
for (const m of ledger.data.months) {
  console.log(`  ${m.period.slice(0, 7)}  total ${String(m.total).padStart(9)}` +
    `  paid ${String(m.paid).padStart(9)}  owing ${String(m.shortfall).padStart(9)}` +
    `  credit ${String(m.credit).padStart(7)}  ${m.status}`);
}
console.log('  summary:', JSON.stringify(ledger.data.summary));

console.log('\n── hand the tenancy to the wife ──');
const wife = lease.data.occupants.find((o) => o.relation === 'wife');
const after = await call('POST', `/leases/${leaseId}/primary`, {
  occupantId: wife.id, outgoingRelation: 'husband',
}, { expect: 201 });
console.log('  now:', after.data.occupants
  .map((o) => `${o.person.fullName} (${o.role}${o.relation ? '/' + o.relation : ''})`).join(', '));

console.log('  the ledger is untouched by the handover:');
const ledger2 = await call('GET', `/leases/${leaseId}/ledger`, null, { expect: 200 });
console.log('   ', JSON.stringify(ledger2.data.summary));

console.log('\n── the outgoing primary cannot be removed while primary ──');
const nowPrimary = after.data.occupants.find((o) => o.role === 'primary');
await call('DELETE', `/leases/${leaseId}/occupants/${nowPrimary.id}`, null, { expect: 400 });

console.log('\n── documents ──');
await call('POST', '/documents', {
  kind: 'agreement', title: 'Rental Agreement - Arjun Mehta', leaseId,
  storageKey: `docs/${stamp}/agreement.pdf`, originalName: 'agreement.pdf',
  mimeType: 'application/pdf', sizeBytes: 248310,
}, { expect: 201 });
const docs = await call('GET', '/documents', null, { expect: 200 });
console.log('  ', docs.data.length, 'document(s)');

console.log('\n── dashboard ──');
const dash = await call('GET', '/dashboard/summary', null, { expect: 200 });
console.log('  units:', JSON.stringify(dash.data.units));
console.log('  rent: ', JSON.stringify(dash.data.rent));
const trend = await call('GET', '/dashboard/trend?months=4', null, { expect: 200 });
console.log('  trend:', trend.data.map((t) => `${t.period} billed ${t.billed} collected ${t.collected}`).join(' | '));

console.log('\n── isolation: a second account sees none of it ──');
const other = await call('POST', '/auth/register', {
  email: `other${stamp}@rentflow.test`, password: 'rentflow-dev-2', name: 'Other',
}, { expect: 201, as: null });
const B = other.data.accessToken;
const theirLeases = await call('GET', '/leases', null, { expect: 200, as: B });
console.log('  B sees', theirLeases.data.length, 'leases');
await call('GET', `/leases/${leaseId}`, null, { expect: 404, as: B });
await call('GET', `/leases/${leaseId}/ledger`, null, { expect: 404, as: B });
await call('POST', `/leases/${leaseId}/primary`,
  { occupantId: wife.id, outgoingRelation: 'wife' }, { expect: 404, as: B });

const failed = results.filter((r) => !r.ok);
console.log(`\n${'─'.repeat(52)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.log(`  FAILED ${f.label}: got ${f.got}, wanted ${f.want}`);
  process.exit(1);
}
