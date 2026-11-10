import test from 'node:test';
import assert from 'node:assert/strict';
import {financeDemo,vatDemo,suppliersDemo} from '../lib/demo-reports.mjs';
import {vatSummary} from '../lib/one-c-vat.mjs';
import {analyze} from '../lib/taxes.mjs';
test('Synthetic payments have all VAT rates, unique IDs, tax remittances and separate transfers',()=>{const r=financeDemo();assert.equal(r.demo,true);assert.equal(new Set(r.rows.map(x=>x.id)).size,r.rows.length);for(const rate of [0,5,7,20,22])assert.ok(r.rows.some(x=>x.sourceVat===rate));assert.ok(r.rows.some(x=>analyze(x).tax==='НДФЛ'));assert.ok(r.transfers.length);assert.ok(r.rows.every(x=>!x.id.startsWith('transfer-')));});
test('Supplier contract balances reconcile without netting advances against other contracts',()=>{for(const period of [['2026-07-01','2026-09-30'],['2026-09-01','2026-09-30'],['2026-11-01','2026-11-10']]){const r=suppliersDemo(...period);assert.equal(r.contracts.length,36);assert.ok(r.contracts.every(c=>c.difference===0));assert.ok(r.contracts.some(c=>c.closingDebt>0));assert.ok(r.contracts.some(c=>c.closingAdvance>0));}});
test('Synthetic VAT changes reconcile to account balance after payments',()=>{const r=vatDemo('2026-07-01','2026-09-30');for(const c of r.organizations){const s=vatSummary(r.entries,r.from,r.to,c.id).buckets.total,b=r.balance.organizations.find(x=>x.companyId===c.id);assert.equal(b.closing,b.opening+s.calculated-s.payment);}});
test('Invalid dates cannot produce misleading demo reports',()=>{assert.throws(()=>vatDemo('x','y'));assert.throws(()=>suppliersDemo('2026-12-01','2026-01-01'));});
