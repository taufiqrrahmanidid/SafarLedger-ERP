// Jalankan: npx tsx scripts/create-user.ts <subdomain> <email> <password> <role> "<Nama Lengkap>"
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const [, , subdomain, email, password, role, ...nameParts] = process.argv;
    const name = nameParts.join(' ') || role;

    if (!subdomain || !email || !password || !role) {
        console.error('Format: npx tsx scripts/create-user.ts <subdomain> <email> <password> <role> "<Nama>"');
        process.exit(1);
    }

    const tenant = await prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) throw new Error(`Tenant subdomain "${subdomain}" tidak ditemukan.`);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
        where: { email: email.toLowerCase() },
        update: { passwordHash, role, name, isActive: true },
        create: { tenantId: tenant.id, email: email.toLowerCase(), passwordHash, role, name, isActive: true },
    });

    console.log(`User siap: ${user.email} (${user.role}) pada tenant ${tenant.name}`);
}

main().finally(() => prisma.$disconnect());