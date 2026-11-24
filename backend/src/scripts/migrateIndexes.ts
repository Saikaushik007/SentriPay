import prisma from '../prismaClient';

async function main() {
  console.log('Migrating indexes and apiKey column...');
  await prisma.$executeRawUnsafe('ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "apiKey" TEXT;');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Agent_apiKey_key" ON "Agent"("apiKey");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON "Transaction"("status");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Transaction_agentId_idx" ON "Transaction"("agentId");');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Transaction_merchant_idx" ON "Transaction"("merchant");');
  
  // Backfill API keys for default agents if missing
  const agents = await prisma.agent.findMany();
  for (const agent of agents) {
    if (!agent.apiKey) {
      const prefix = agent.id.includes('alpha') ? 'alpha' : agent.id.includes('beta') ? 'beta' : 'gamma';
      const key = `sk_live_${prefix}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`;
      await prisma.agent.update({
        where: { id: agent.id },
        data: { apiKey: key }
      });
      console.log(`Assigned API key for ${agent.id}`);
    }
  }

  console.log('SUCCESS: All indexes and API keys applied successfully');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
