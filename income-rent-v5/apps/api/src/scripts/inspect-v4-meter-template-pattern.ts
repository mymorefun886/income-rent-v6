// Understand V4 meter template pattern - how drafts are generated
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Get all meterDrafts
  const drafts = await db.execute(`SELECT * FROM meterDrafts`);
  const parsed = drafts.rows.map((r: any) => JSON.parse(r.data));

  // Group by building
  const byBuilding: Record<string, any[]> = {};
  for (const d of parsed) {
    if (!byBuilding[d.building]) byBuilding[d.building] = [];
    byBuilding[d.building].push(d);
  }

  console.log('=== Meter Drafts by Building ===');
  for (const [building, records] of Object.entries(byBuilding)) {
    const cycles = [...new Set(records.map(r => r.cycle))].sort();
    console.log(`\n${building}:`);
    console.log(`  Total drafts: ${records.length}`);
    console.log(`  Cycles: ${cycles.join(', ')}`);

    // Show rooms in latest cycle
    const latestCycle = cycles[cycles.length - 1];
    const latestRooms = records.filter(r => r.cycle === latestCycle).map(r => r.room);
    console.log(`  Rooms in ${latestCycle}: ${latestRooms.join(', ')}`);
  }

  // Check if rooms are consistent across cycles (template pattern)
  console.log('\n=== Room Consistency Check ===');
  for (const [building, records] of Object.entries(byBuilding)) {
    const cycles = [...new Set(records.map(r => r.cycle))].sort();
    const roomsPerCycle = cycles.map(c => ({
      cycle: c,
      rooms: [...new Set(records.filter(r => r.cycle === c).map(r => r.room))].sort()
    }));

    console.log(`\n${building}:`);
    for (const { cycle, rooms } of roomsPerCycle) {
      console.log(`  ${cycle}: ${rooms.length} rooms`);
    }
  }

  await db.close();
}

main().catch(console.error);
