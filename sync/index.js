// index.js — aiOS Sync Engine entry point
// Usage: node index.js [adapter]
//   node index.js school-master   → sync CSDI school master
//   node index.js school-profile  → sync CHSC school profiles
//   node index.js vacancy         → sync EDB KG vacancy
//   node index.js school-net      → sync CSDI school nets
//   node index.js all             → run all Phase 1 adapters

import { end } from './lib/db.js';

const adapters = {
  'school-master': async () => { const m = await import('./lib/adapters/csdi_school_master.js'); await m.syncSchoolMaster(); },
  'school-net':    async () => { const m = await import('./lib/adapters/csdi_school_net.js');    await m.syncSchoolNet(); },
  'vacancy':       async () => { const m = await import('./lib/adapters/edb_vacancy.js');        await m.syncVacancy(); },
  // Phase 1 adapters to follow:
  'school-profile': async () => { const m = await import('./lib/adapters/chsc_school_profile.js'); await m.syncSchoolProfile(); },
  // 'vacancy':        async () => { const m = await import('./lib/adapters/edb_vacancy.js'); await m.syncVacancy(); },
  // 'school-net':     async () => { const m = await import('./lib/adapters/csdi_school_net.js'); await m.syncSchoolNet(); },
};

async function main() {
  const target = process.argv[2] || 'school-master';

  if (target === 'all') {
    for (const [name, run] of Object.entries(adapters)) {
      console.log(`\n━━━ ${name} ━━━`);
      try {
        await run();
      } catch (err) {
        console.error(`[${name}] FAILED:`, err.message);
      }
    }
  } else if (adapters[target]) {
    await adapters[target]();
  } else {
    console.error(`Unknown adapter: ${target}`);
    console.error(`Available: ${Object.keys(adapters).join(', ')}, all`);
    process.exit(1);
  }

  await end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
