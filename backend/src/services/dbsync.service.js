import pkg from 'pg';
const { Client } = pkg;
import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient();

// Tables in the correct order (respecting FK dependencies)
const SYNC_TABLE_ORDER = [
  'categories',
  'products',
  'product_units',
  'product_batches',
  'users',
  'customers',
  'upi_accounts',
  'shop_settings',
  'sales_invoices',
  'invoice_items',
  'invoice_item_batch_allocations',
  'sales_invoice_refunds',
  'audit_logs',
];

// Tables to DELETE in reverse order before pull (to avoid FK constraint violations)
const REVERSE_ORDER = [...SYNC_TABLE_ORDER].reverse();

/**
 * Creates a pg Client connected to the given Supabase/Postgres URL.
 */
async function createRemoteClient(supabaseDirectUrl) {
  const client = new Client({ connectionString: supabaseDirectUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/**
 * Test connection to Supabase.
 */
export const testConnection = async (supabaseDirectUrl) => {
  let client;
  try {
    client = await createRemoteClient(supabaseDirectUrl);
    const result = await client.query('SELECT current_database(), current_user, version()');
    return {
      success: true,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
    };
  } finally {
    if (client) await client.end().catch(() => {});
  }
};

/**
 * Push local data → Supabase (upsert all rows).
 */
export const pushToSupabase = async (supabaseDirectUrl) => {
  let remoteClient;
  const report = [];
  const errors = [];

  try {
    remoteClient = await createRemoteClient(supabaseDirectUrl);

    // Get local DB URL from prisma env
    const localUrl = process.env.DATABASE_URL;
    const localClient = new Client({ connectionString: localUrl });
    await localClient.connect();

    try {
      for (const table of SYNC_TABLE_ORDER) {
        try {
          // Fetch all rows from local
          const { rows } = await localClient.query(`SELECT * FROM "${table}"`);
          
          if (rows.length === 0) {
            report.push({ table, rows: 0, status: 'skipped (empty)' });
            continue;
          }

          // Get column names from first row
          const columns = Object.keys(rows[0]);
          const colList = columns.map(c => `"${c}"`).join(', ');
          
          // Build upsert: INSERT ... ON CONFLICT (id) DO UPDATE SET ...
          // We assume all tables have an "id" primary key
          const updateSet = columns
            .filter(c => c !== 'id')
            .map(c => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');

          let syncedCount = 0;
          // Batch insert in chunks of 100
          const chunkSize = 100;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const values = chunk.map((row, rowIdx) => {
              const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
              return `(${placeholders.join(', ')})`;
            }).join(', ');
            const flatValues = chunk.flatMap(row => columns.map(c => row[c]));
            
            const sql = updateSet
              ? `INSERT INTO "${table}" (${colList}) VALUES ${values} ON CONFLICT (id) DO UPDATE SET ${updateSet}`
              : `INSERT INTO "${table}" (${colList}) VALUES ${values} ON CONFLICT (id) DO NOTHING`;
            
            await remoteClient.query(sql, flatValues);
            syncedCount += chunk.length;
          }

          report.push({ table, rows: rows.length, status: 'synced' });
        } catch (tableErr) {
          errors.push({ table, error: tableErr.message });
          report.push({ table, rows: 0, status: `error: ${tableErr.message}` });
        }
      }
    } finally {
      await localClient.end().catch(() => {});
    }

    return { success: true, report, errors, direction: 'local→supabase' };
  } finally {
    if (remoteClient) await remoteClient.end().catch(() => {});
  }
};

/**
 * Pull Supabase data → local (replace all rows — destructive).
 */
export const pullFromSupabase = async (supabaseDirectUrl) => {
  let remoteClient;
  let localClient;
  const report = [];
  const errors = [];

  try {
    remoteClient = await createRemoteClient(supabaseDirectUrl);

    const localUrl = process.env.DATABASE_URL;
    localClient = new Client({ connectionString: localUrl });
    await localClient.connect();

    // Disable FK constraints temporarily for truncation
    await localClient.query('SET session_replication_role = replica');

    try {
      // Truncate local tables in reverse order
      for (const table of REVERSE_ORDER) {
        try {
          await localClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
        } catch (_) {}
      }

      // Insert from Supabase in correct order
      for (const table of SYNC_TABLE_ORDER) {
        try {
          const { rows } = await remoteClient.query(`SELECT * FROM "${table}"`);
          
          if (rows.length === 0) {
            report.push({ table, rows: 0, status: 'skipped (empty)' });
            continue;
          }

          const columns = Object.keys(rows[0]);
          const colList = columns.map(c => `"${c}"`).join(', ');

          const chunkSize = 100;
          let syncedCount = 0;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const values = chunk.map((row, rowIdx) => {
              const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
              return `(${placeholders.join(', ')})`;
            }).join(', ');
            const flatValues = chunk.flatMap(row => columns.map(c => row[c]));
            
            await localClient.query(
              `INSERT INTO "${table}" (${colList}) VALUES ${values}`,
              flatValues
            );
            syncedCount += chunk.length;
          }

          report.push({ table, rows: rows.length, status: 'synced' });
        } catch (tableErr) {
          errors.push({ table, error: tableErr.message });
          report.push({ table, rows: 0, status: `error: ${tableErr.message}` });
        }
      }
    } finally {
      // Re-enable FK constraints
      await localClient.query('SET session_replication_role = DEFAULT').catch(() => {});
    }

    return { success: true, report, errors, direction: 'supabase→local' };
  } finally {
    if (remoteClient) await remoteClient.end().catch(() => {});
    if (localClient) await localClient.end().catch(() => {});
  }
};

/**
 * Save Supabase credentials to ShopSetting table.
 */
export const saveSupabaseCredentials = async (supabaseDirectUrl) => {
  await localPrisma.shopSetting.upsert({
    where: { key: 'supabase_direct_url' },
    update: { value: supabaseDirectUrl },
    create: { key: 'supabase_direct_url', value: supabaseDirectUrl },
  });
  return { success: true };
};

/**
 * Get saved Supabase credentials from ShopSetting table.
 */
export const getSupabaseCredentials = async () => {
  const urlSetting = await localPrisma.shopSetting.findUnique({ where: { key: 'supabase_direct_url' } });
  return {
    supabaseDirectUrl: urlSetting?.value || '',
  };
};
