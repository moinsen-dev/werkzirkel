/**
 * Seed-Daten für lokale Entwicklung.
 *
 * Idempotent: nutzt INSERT ... ON CONFLICT DO NOTHING.
 * Aufruf: `pnpm db:seed` nach `pnpm db:migrate`.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { stadt, nutzer } from './schema';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://werkzirkel:werkzirkel_dev@localhost:5432/werkzirkel';

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@werkzirkel.de';
const SEED_KURATOR_HH_EMAIL =
  process.env.SEED_KURATOR_HH_EMAIL ?? 'hamburg@werkzirkel.de';

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema, casing: 'snake_case' });

async function run() {
  console.log('▸ Seed startet …');

  // Städte
  await db
    .insert(stadt)
    .values([
      {
        id: 'hh',
        name: 'Hamburg',
        status: 'aktiv',
        beschreibung: 'Aktiver Hamburger Kreis — erster regionaler Zirkel.',
        sortierung: 10,
      },
      {
        id: 'b',
        name: 'Berlin',
        status: 'vorbereitung',
        beschreibung: 'In Vorbereitung — aktiv, sobald Hamburg trägt.',
        sortierung: 20,
      },
      {
        id: 'm',
        name: 'München',
        status: 'vorbereitung',
        beschreibung: 'In Vorbereitung — folgt mit Versatz nach Berlin.',
        sortierung: 30,
      },
    ])
    .onConflictDoNothing();
  console.log('  ✓ Drei Städte (Hamburg aktiv, Berlin/München in Vorbereitung)');

  // Admin-Konto
  const adminId = createId();
  await db
    .insert(nutzer)
    .values({
      id: adminId,
      email: SEED_ADMIN_EMAIL,
      klarname: 'Werkzirkel Admin',
      anzeigename: 'Admin',
      stadtId: 'hh',
      rollen: ['admin'],
      status: 'aktiv',
      emailVerifiziertAm: new Date(),
    })
    .onConflictDoNothing({ target: nutzer.email });
  console.log(`  ✓ Admin-Konto (${SEED_ADMIN_EMAIL})`);

  // Hamburger Kurator:in
  const kuratorId = createId();
  await db
    .insert(nutzer)
    .values({
      id: kuratorId,
      email: SEED_KURATOR_HH_EMAIL,
      klarname: 'Hamburger Kurator:in',
      anzeigename: 'Kurator:in Hamburg',
      stadtId: 'hh',
      rollen: ['kurator', 'macher'],
      status: 'aktiv',
      emailVerifiziertAm: new Date(),
    })
    .onConflictDoNothing({ target: nutzer.email });
  console.log(`  ✓ Hamburger Kurator:in (${SEED_KURATOR_HH_EMAIL})`);

  // Kurator-Verknüpfung zur Stadt
  await db.execute(sql`
    UPDATE stadt SET kurator_id = (SELECT id FROM nutzer WHERE email = ${SEED_KURATOR_HH_EMAIL})
    WHERE id = 'hh' AND kurator_id IS NULL
  `);
  console.log('  ✓ Kurator:in mit Stadt Hamburg verknüpft');

  console.log('✓ Seed fertig.');
  await client.end();
}

run().catch((err) => {
  console.error('✗ Seed fehlgeschlagen:', err);
  process.exit(1);
});
