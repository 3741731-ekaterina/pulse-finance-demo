// Reports only: never store credentials. Shared across route chunks in this tab.
const slot=Symbol.for('pulse.report-memory.v1');
const ttl=30*60*1000;
function cache(){return globalThis[slot]??=(new Map());}
export function rememberReport(key,report){cache().set(key,{report,expires:Date.now()+ttl});}
export function recalledReport(key){const item=cache().get(key);if(!item||item.expires<=Date.now()){cache().delete(key);return null;}return item.report;}
export function forgetReports(prefix){for(const key of cache().keys())if(key.startsWith(prefix))cache().delete(key);}
