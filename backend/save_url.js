import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.shopSetting.upsert({
    where: { key: 'supabase_direct_url' },
    update: { value: 'postgresql://postgres.npboltzjybcihvnouiyi:917877496745@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' },
    create: { key: 'supabase_direct_url', value: 'postgresql://postgres.npboltzjybcihvnouiyi:917877496745@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' },
  });
  console.log('Saved Supabase URL to local database');
}
main();
