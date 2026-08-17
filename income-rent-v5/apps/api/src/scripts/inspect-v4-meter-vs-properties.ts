// Check V4 properties to see if meter rooms match property rooms
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Get all properties
  const props = await db.execute(`SELECT * FROM properties`);
  const parsed = props.rows.map((r: any) => JSON.parse(r.data));

  // Group by building
  const byBuilding: Record<string, any[]> = {};
  for (const p of parsed) {
    if (!byBuilding[p.building]) byBuilding[p.building] = [];
    byBuilding[p.building].push(p);
  }

  console.log('=== Properties by Building ===');
  for (const [building, records] of Object.entries(byBuilding)) {
    console.log(`\n${building}: ${records.length} properties`);
    const rooms = records.map(r => r.room).sort();
    console.log(`  Rooms: ${rooms.join(', ')}`);
  }

  // Get meter drafts rooms
  const drafts = await db.execute(`SELECT * FROM meterDrafts`);
  const draftParsed = drafts.rows.map((r: any) => JSON.parse(r.data));

  const draftsByBuilding: Record<string, Set<string>> = {};
  for (const d of draftParsed) {
    if (!draftsByBuilding[d.building]) draftsByBuilding[d.building] = new Set();
    draftsByBuilding[d.building].add(d.room);
  }

  console.log('\n=== Meter Draft Rooms by Building ===');
  for (const [building, rooms] of Object.entries(draftsByBuilding)) {
    console.log(`\n${building}: ${rooms.size} rooms`);
    console.log(`  Rooms: ${[...rooms].sort().join(', ')}`);
  }

  await db.close();
}

main().catch(console.error);
