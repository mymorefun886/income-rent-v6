// Inspect V4 meter readings data patterns
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Get all meterReadings
  const readings = await db.execute(`SELECT * FROM meterReadings`);
  console.log(`=== Total meterReadings: ${readings.rows.length} ===`);

  // Parse data and analyze
  const parsed = readings.rows.map((r: any) => {
    try {
      return { id: r.id, ...JSON.parse(r.data) };
    } catch {
      return { id: r.id, raw: r.data };
    }
  });

  // Show first 10
  console.log('\n--- Latest 10 readings ---');
  console.log(JSON.stringify(parsed.slice(0, 10), null, 2));

  // Get unique buildings
  const buildings = [...new Set(parsed.map((r: any) => r.building).filter(Boolean))];
  console.log('\n--- Buildings ---');
  console.log(buildings);

  // Get unique rooms
  const rooms = [...new Set(parsed.map((r: any) => r.room).filter(Boolean))];
  console.log('\n--- Rooms ---');
  console.log(rooms);

  // Get unique periods/cycles
  const periods = [...new Set(parsed.map((r: any) => r.period || r.cycle).filter(Boolean))];
  console.log('\n--- Periods/Cycles ---');
  console.log(periods);

  await db.close();
}

main().catch(console.error);
