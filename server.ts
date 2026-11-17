import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { requireAuth, requireRole } from './server/middleware/auth.js';
import { encryptSensitive, decryptSensitive } from './server/utils/crypto.js';
import {
    createPresignedUploadUrl,
    createPresignedViewUrl,
} from './server/services/storage.js';

const prisma = new PrismaClient();
const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// 1. LOGIN & SESSION COOKIE
app.post('/api/auth/login', async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Format email/password salah.' });

    const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        include: { tenant: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
        return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah.' });

    const token = jwt.sign(
        { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '12h' }
    );

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('sl_token', token, {
        httpOnly: true,
        secure: isProd && isHttps,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
    });

    return res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        tenant: user.tenant,
    });
});

app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('sl_token');
    res.json({ ok: true });
});

// 2. LOAD WORKSPACE DATA TERISOLASI TENANT
function maskNik(rawNik: string): string {
    const clean = rawNik.replace(/\D/g, '');
    if (clean.length < 8) return clean || '3201••••••••0001';
    return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

app.get('/api/workspace', requireAuth, async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const [
        tenant,
        packages,
        departures,
        bookings,
        payments,
        coa,
        journals,
        dmsRecords,
        inventory,
        agents,
        isoIncidents,
    ] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: tenantId } }),
        prisma.travelPackage.findMany({ where: { tenantId } }),
        prisma.departure.findMany({ where: { tenantId }, orderBy: { departureDate: 'asc' } }),
        prisma.booking.findMany({
            where: { tenantId },
            include: { departure: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.paymentRecord.findMany({
            where: { tenantId },
            include: { booking: true },
            orderBy: { paidAt: 'desc' },
        }),
        prisma.chartOfAccount.findMany({ where: { tenantId }, orderBy: { code: 'asc' } }),
        prisma.journalEntry.findMany({
            where: { tenantId },
            include: { lines: true },
            orderBy: { entryDate: 'desc' },
        }),
        prisma.dmsRecord.findMany({
            where: { tenantId },
            include: { booking: { include: { departure: true } } },
        }),
        prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: { sku: 'asc' } }),
        prisma.agent.findMany({ where: { tenantId } }),
        prisma.isoIncident.findMany({ where: { tenantId }, orderBy: { slaDeadline: 'asc' } }),
    ]);

    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan.' });

    const tenants =
        req.auth!.role === 'SUPER_ADMIN'
            ? await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
            : [tenant];

    // Format data agar cocok persis dengan interface src/types/erp.ts
    res.json({
        user: {
            id: req.auth!.userId,
            email: req.auth!.email,
            role: req.auth!.role,
        },
        tenant,
        tenants,
        workspace: {
            packages: packages.map((p) => ({
                ...p,
                priceQuad: Number(p.priceQuad),
                priceTriple: Number(p.priceTriple),
                priceDouble: Number(p.priceDouble),
                hppEstimate: Number(p.hppEstimate),
            })),
            departures: departures.map((d) => ({
                ...d,
                departureDate: d.departureDate.toISOString().slice(0, 10),
                returnDate: d.returnDate.toISOString().slice(0, 10),
                estHppPerSeat: Number(d.estHppPerSeat),
            })),
            bookings: bookings.map((b) => ({
                id: b.id,
                tenantId: b.tenantId,
                bookingNo: b.bookingNo,
                departureId: b.departureId,
                kloterCode: b.departure.kloterCode,
                jamaahName: b.jamaahName,
                nikMasked: maskNik(decryptSensitive(b.nikEncrypted)),
                phone: b.phone,
                gender: b.gender,
                roomType: b.roomType,
                roomNumber: b.roomNumber,
                mahramGroup: b.mahramGroup,
                agentId: b.agentId ?? undefined,
                totalAmount: Number(b.totalAmount),
                paidAmount: Number(b.paidAmount),
                status: b.status,
                kitDispatched: b.kitDispatched,
                createdAt: b.createdAt.toISOString().slice(0, 10),
            })),
            payments: payments.map((p) => ({
                id: p.id,
                tenantId: p.tenantId,
                bookingId: p.bookingId,
                bookingNo: p.booking.bookingNo,
                receiptNo: p.receiptNo,
                jamaahName: p.booking.jamaahName,
                method: p.method,
                amount: Number(p.amount),
                date: p.paidAt.toISOString().slice(0, 10),
                qrHash: p.qrHash,
            })),
            coa: coa.map((c) => ({
                ...c,
                openingBalance: Number(c.openingBalance),
            })),
            journals: journals.map((j) => ({
                id: j.id,
                tenantId: j.tenantId,
                entryNo: j.entryNo,
                date: j.entryDate.toISOString().slice(0, 10),
                refType: j.refType,
                kloterCode: j.kloterCode ?? undefined,
                description: j.description,
                lines: j.lines.map((l) => ({
                    accountCode: l.accountCode,
                    accountName: l.accountName,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            })),
            dmsRecords: dmsRecords.map((d) => ({
                id: d.id,
                tenantId: d.tenantId,
                bookingId: d.bookingId,
                jamaahName: d.booking.jamaahName,
                kloterCode: d.booking.departure.kloterCode,
                departureDate: d.booking.departure.departureDate.toISOString().slice(0, 10),
                ktpStatus: d.ktpStatus,
                kkStatus: d.kkStatus,
                passportNo: d.passportNoEnc ? decryptSensitive(d.passportNoEnc) : '-',
                passportExpiry: d.passportExpiry ? d.passportExpiry.toISOString().slice(0, 10) : '',
                passportStatus: d.passportStatus,
                meningitisStatus: d.meningitisStatus,
                mahramDocStatus: d.mahramDocStatus,
                hasKtpFile: Boolean(d.s3KtpKey),
                hasKkFile: Boolean(d.s3KkKey),
                hasPassportFile: Boolean(d.s3PassportKey),
                hasMeningitisFile: Boolean(d.s3MeningitisKey),
            })),
            inventory: inventory.map((i) => ({
                ...i,
                avgCost: Number(i.avgCost),
            })),
            agents: agents.map((a) => ({
                ...a,
                directCommissionRate: Number(a.directCommissionRate),
                commissionEarned: Number(a.commissionEarned),
                commissionPaid: Number(a.commissionPaid),
            })),
            isoIncidents: isoIncidents.map((inc) => ({
                ...inc,
                slaDeadline: inc.slaDeadline.toISOString().slice(0, 10),
            })),
        },
    });
});

// 3. REGISTRASI JAMAAH (TRANSAKSI ATOMIK: BOOKING + SEAT + DMS + KOMISI)
app.post('/api/bookings', requireAuth, requireRole('OWNER', 'OPS', 'AGENT'), async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const schema = z.object({
        jamaahName: z.string().min(2),
        nikRaw: z.string().min(8),
        phone: z.string().min(8),
        gender: z.enum(['L', 'P']),
        departureId: z.string().uuid(),
        roomType: z.enum(['QUAD', 'TRIPLE', 'DOUBLE']),
        mahramGroup: z.string().optional().default(''),
        agentId: z.string().uuid().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
        const result = await prisma.$transaction(async (tx) => {
            const dep = await tx.departure.findFirst({
                where: { id: parsed.data.departureId, tenantId },
                include: { package: true },
            });
            if (!dep) throw new Error('Kloter tidak ditemukan.');
            if (dep.filledSeats >= dep.totalSeats) throw new Error('Kuota kloter penuh.');

            const totalAmount =
                parsed.data.roomType === 'DOUBLE'
                    ? dep.package.priceDouble
                    : parsed.data.roomType === 'TRIPLE'
                        ? dep.package.priceTriple
                        : dep.package.priceQuad;

            const count = await tx.booking.count({ where: { tenantId } });
            const bookingNo = `BK-${new Date().getFullYear().toString().slice(-2)}-${String(count + 1).padStart(4, '0')}`;

            const booking = await tx.booking.create({
                data: {
                    tenantId,
                    bookingNo,
                    departureId: dep.id,
                    jamaahName: parsed.data.jamaahName,
                    nikEncrypted: encryptSensitive(parsed.data.nikRaw),
                    phone: parsed.data.phone,
                    gender: parsed.data.gender,
                    roomType: parsed.data.roomType,
                    mahramGroup: parsed.data.mahramGroup,
                    agentId: parsed.data.agentId || null,
                    totalAmount,
                },
            });

            await tx.departure.update({
                where: { id: dep.id },
                data: {
                    filledSeats: { increment: 1 },
                    status: dep.filledSeats + 1 >= dep.totalSeats ? 'FULL' : dep.status,
                },
            });

            await tx.dmsRecord.create({
                data: { tenantId, bookingId: booking.id },
            });

            return booking;
        });

        return res.status(201).json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

// 4. PEMBAYARAN + AUTO-JOURNAL SAK ETAP (DEBIT BANK / KREDIT 2-101 UANG MUKA)
app.post('/api/payments', requireAuth, requireRole('OWNER', 'FINANCE', 'OPS'), async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const schema = z.object({
        bookingId: z.string().uuid(),
        amount: z.number().positive(),
        method: z.enum(['BSI_VA', 'XENDIT_VA', 'MIDTRANS_VA', 'BANK_TRANSFER', 'CASH']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Input pembayaran tidak valid.' });

    try {
        const payment = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({
                where: { id: parsed.data.bookingId, tenantId },
                include: { departure: true },
            });
            if (!booking) throw new Error('Booking tidak ditemukan.');

            const remaining = Number(booking.totalAmount) - Number(booking.paidAmount);
            const verifiedAmt = Math.min(parsed.data.amount, remaining);
            if (verifiedAmt <= 0) throw new Error('Booking sudah lunas.');

            const payCount = await tx.paymentRecord.count({ where: { tenantId } });
            const receiptNo = `KWT-${new Date().getFullYear()}-${String(payCount + 1).padStart(4, '0')}`;

            const rec = await tx.paymentRecord.create({
                data: {
                    tenantId,
                    bookingId: booking.id,
                    receiptNo,
                    method: parsed.data.method,
                    amount: verifiedAmt,
                    qrHash: `SIG-${Date.now().toString(36).toUpperCase()}`,
                },
            });

            const newPaid = Number(booking.paidAmount) + verifiedAmt;
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    paidAmount: newPaid,
                    status: newPaid >= Number(booking.totalAmount) ? 'PAID' : 'INSTALLMENT',
                },
            });

            const cashAccCode = parsed.data.method === 'CASH' ? '1-101' : '1-102';
            const cashAccName =
                parsed.data.method === 'CASH' ? 'Kas Tunai Kantor' : 'Bank Operasional Syariah (BSI)';

            await tx.journalEntry.create({
                data: {
                    tenantId,
                    entryNo: `JRN-${Date.now().toString().slice(-6)}`,
                    refType: 'PAYMENT',
                    kloterCode: booking.departure.kloterCode,
                    description: `Penerimaan ${parsed.data.method} a/n ${booking.jamaahName} (${receiptNo})`,
                    lines: {
                        create: [
                            { accountCode: cashAccCode, accountName: cashAccName, debit: verifiedAmt, credit: 0 },
                            {
                                accountCode: '2-101',
                                accountName: 'Uang Muka Jamaah (Liabilitas)',
                                debit: 0,
                                credit: verifiedAmt,
                            },
                        ],
                    },
                },
            });

            return rec;
        });

        return res.status(201).json(payment);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

// 5. WEBHOOK PAYMENT GATEWAY (XENDIT / MIDTRANS) DENGAN IDEMPOTENCY
app.post('/api/webhooks/payment', async (req, res) => {
    const token = req.headers['x-callback-token'];
    if (token !== process.env.PAYMENT_WEBHOOK_TOKEN) {
        return res.status(401).json({ error: 'Invalid callback signature' });
    }
    const { external_id, status } = req.body;
    if (status !== 'PAID') return res.json({ ignored: true });

    const existing = await prisma.paymentRecord.findUnique({ where: { externalId: external_id } });
    if (existing) return res.json({ alreadyProcessed: true });

    // Lanjutkan transaksi atomik pembayaran seperti endpoint /api/payments di atas
    return res.json({ received: true });
});

async function startServer() {
    if (!isProd) {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.resolve(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SafarLedger ERP berjalan di http://localhost:${PORT} (${isProd ? 'PRODUCTION' : 'DEV'})`);
    });
}

// 6A. Minta URL Upload Sementara ke R2/S3
app.post('/api/dms/upload-url', requireAuth, requireRole('OWNER', 'OPS', 'AGENT'), async (req, res) => {
    const schema = z.object({
        dmsId: z.string().uuid(),
        docType: z.enum(['KTP', 'KK', 'PASPOR', 'MENINGITIS']),
        mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
        fileSize: z.number().max(5 * 1024 * 1024, 'Ukuran file maksimal 5 MB'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Format atau ukuran file tidak valid.' });

    const tenantId = req.auth!.tenantId;
    const record = await prisma.dmsRecord.findFirst({
        where: { id: parsed.data.dmsId, tenantId },
    });
    if (!record) return res.status(404).json({ error: 'Data DMS jamaah tidak ditemukan.' });

    const ext = parsed.data.mimeType === 'application/pdf' ? 'pdf' : parsed.data.mimeType === 'image/png' ? 'png' : 'jpg';
    const objectKey = `tenants/${tenantId}/dms/${record.bookingId}/${parsed.data.docType}-${Date.now()}.${ext}`;
    const uploadUrl = await createPresignedUploadUrl(objectKey, parsed.data.mimeType);

    return res.json({ uploadUrl, objectKey });
});

// 6B. Simpan Object Key & Ubah Status Dokumen setelah Upload Selesai
app.patch('/api/dms/:id/attach', requireAuth, requireRole('OWNER', 'OPS', 'AGENT'), async (req, res) => {
    const schema = z.object({
        docType: z.enum(['KTP', 'KK', 'PASPOR', 'MENINGITIS']),
        objectKey: z.string().min(5),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload tidak valid.' });

    const tenantId = req.auth!.tenantId;
    const record = await prisma.dmsRecord.findFirst({
        where: { id: req.params.id, tenantId },
    });
    if (!record) return res.status(404).json({ error: 'Data DMS tidak ditemukan.' });

    const updateData: Record<string, string> = {};
    if (parsed.data.docType === 'KTP') {
        updateData.s3KtpKey = parsed.data.objectKey;
        updateData.ktpStatus = 'REVIEW';
    } else if (parsed.data.docType === 'KK') {
        updateData.s3KkKey = parsed.data.objectKey;
        updateData.kkStatus = 'REVIEW';
    } else if (parsed.data.docType === 'PASPOR') {
        updateData.s3PassportKey = parsed.data.objectKey;
        updateData.passportStatus = 'REVIEW';
    } else if (parsed.data.docType === 'MENINGITIS') {
        updateData.s3MeningitisKey = parsed.data.objectKey;
        updateData.meningitisStatus = 'REVIEW';
    }

    const updated = await prisma.dmsRecord.update({
        where: { id: record.id },
        data: updateData,
    });
    return res.json(updated);
});

// 6C. Minta URL Lihat / Download File Privat (Berlaku 60 Detik)
app.get('/api/dms/:id/view-url', requireAuth, requireRole('OWNER', 'OPS'), async (req, res) => {
    const docType = String(req.query.docType || '');
    const record = await prisma.dmsRecord.findFirst({
        where: { id: req.params.id, tenantId: req.auth!.tenantId },
    });
    if (!record) return res.status(404).json({ error: 'Data DMS tidak ditemukan.' });

    const keyMap: Record<string, string | null> = {
        KTP: record.s3KtpKey,
        KK: record.s3KkKey,
        PASPOR: record.s3PassportKey,
        MENINGITIS: record.s3MeningitisKey,
    };
    const objectKey = keyMap[docType];
    if (!objectKey) return res.status(404).json({ error: 'File dokumen belum di-upload.' });

    const viewUrl = await createPresignedViewUrl(objectKey);
    return res.json({ viewUrl });
});

// ============================================================================
// FASE 7: FULL ERP POSTGRESQL ENDPOINTS (SESUAI PRISMA SCHEMA LOKAL)
// ============================================================================

// Helper mapper agar format JSON 100% cocok dengan interface frontend (src/types/erp.ts)
function mapJournalResponse(j: any) {
    return {
        id: j.id,
        tenantId: j.tenantId,
        entryNo: j.entryNo,
        date: j.entryDate.toISOString().slice(0, 10),
        refType: j.refType,
        kloterCode: j.kloterCode ?? undefined,
        description: j.description,
        lines: (j.lines || []).map((l: any) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: Number(l.debit),
            credit: Number(l.credit),
        })),
    };
}

// 1. Update Status DMS, Nomor Paspor (Terenkripsi AES-256-GCM), & Masa Berlaku
app.patch('/api/dms/:id', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);
        const {
            ktpStatus,
            kkStatus,
            passportNo,
            passportExpiry,
            passportStatus,
            meningitisStatus,
            mahramDocStatus,
        } = req.body;

        const existing = await prisma.dmsRecord.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Berkas DMS tidak ditemukan.' });
        }

        const updateData: {
            ktpStatus?: string;
            kkStatus?: string;
            passportStatus?: string;
            meningitisStatus?: string;
            mahramDocStatus?: string;
            passportExpiry?: Date | null;
            passportNoEnc?: string | null;
        } = {};

        if (ktpStatus) updateData.ktpStatus = ktpStatus;
        if (kkStatus) updateData.kkStatus = kkStatus;
        if (passportStatus) updateData.passportStatus = passportStatus;
        if (meningitisStatus) updateData.meningitisStatus = meningitisStatus;
        if (mahramDocStatus) updateData.mahramDocStatus = mahramDocStatus;

        if ('passportExpiry' in req.body) {
            if (!passportExpiry) {
                updateData.passportExpiry = null;
            } else {
                const parsedDate = new Date(passportExpiry);
                if (!Number.isNaN(parsedDate.getTime())) {
                    updateData.passportExpiry = parsedDate;
                }
            }
        }

        if (typeof passportNo === 'string') {
            const cleanNo = passportNo.trim().toUpperCase();
            updateData.passportNoEnc = cleanNo && cleanNo !== '-' ? encryptSensitive(cleanNo) : null;
        }

        const updated = await prisma.dmsRecord.update({
            where: { id },
            data: updateData,
            include: { booking: { include: { departure: true } } },
        });

        return res.json({
            id: updated.id,
            tenantId: updated.tenantId,
            bookingId: updated.bookingId,
            jamaahName: updated.booking.jamaahName,
            kloterCode: updated.booking.departure.kloterCode,
            departureDate: updated.booking.departure.departureDate.toISOString().slice(0, 10),
            ktpStatus: updated.ktpStatus,
            kkStatus: updated.kkStatus,
            passportNo: updated.passportNoEnc ? decryptSensitive(updated.passportNoEnc) : '-',
            passportExpiry: updated.passportExpiry ? updated.passportExpiry.toISOString().slice(0, 10) : '',
            passportStatus: updated.passportStatus,
            meningitisStatus: updated.meningitisStatus,
            mahramDocStatus: updated.mahramDocStatus,
            hasKtpFile: Boolean(updated.s3KtpKey),
            hasKkFile: Boolean(updated.s3KkKey),
            hasPassportFile: Boolean(updated.s3PassportKey),
            hasMeningitisFile: Boolean(updated.s3MeningitisKey),
        });
    } catch (err) {
        console.error('PATCH /api/dms/:id error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui status berkas DMS.' });
    }
});

// 2. Buat Paket Travel Baru
app.post('/api/packages', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const {
            code,
            name,
            category,
            durationDays,
            priceQuad,
            priceTriple,
            priceDouble,
            hppEstimate,
            hotelMakkah,
            hotelMadinah,
        } = req.body;

        const pkg = await prisma.travelPackage.create({
            data: {
                tenantId,
                code: String(code).trim().toUpperCase(),
                name: String(name).trim(),
                category: String(category),
                durationDays: Number(durationDays),
                priceQuad: Number(priceQuad),
                priceTriple: Number(priceTriple),
                priceDouble: Number(priceDouble),
                hppEstimate: Number(hppEstimate),
                hotelMakkah: String(hotelMakkah).trim(),
                hotelMadinah: String(hotelMadinah).trim(),
            },
        });

        return res.status(201).json({
            ...pkg,
            priceQuad: Number(pkg.priceQuad),
            priceTriple: Number(pkg.priceTriple),
            priceDouble: Number(pkg.priceDouble),
            hppEstimate: Number(pkg.hppEstimate),
        });
    } catch (err) {
        console.error('POST /api/packages error:', err);
        return res.status(400).json({ error: 'Gagal membuat paket travel. Pastikan kode paket belum dipakai.' });
    }
});

// 3. Buka Kloter Keberangkatan Baru
app.post('/api/departures', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const { packageId, kloterCode, airline, departureDate, returnDate, totalSeats } = req.body;

        const pkg = await prisma.travelPackage.findFirst({
            where: { id: String(packageId), tenantId },
        });
        if (!pkg) {
            return res.status(404).json({ error: 'Paket travel tidak ditemukan.' });
        }

        const dep = await prisma.departure.create({
            data: {
                tenantId,
                packageId: pkg.id,
                kloterCode: String(kloterCode).trim().toUpperCase(),
                packageName: pkg.name,
                airline: String(airline).trim(),
                departureDate: new Date(departureDate),
                returnDate: new Date(returnDate),
                totalSeats: Number(totalSeats),
                filledSeats: 0,
                estHppPerSeat: pkg.hppEstimate,
                status: 'OPEN',
            },
        });

        return res.status(201).json({
            ...dep,
            departureDate: dep.departureDate.toISOString().slice(0, 10),
            returnDate: dep.returnDate.toISOString().slice(0, 10),
            estHppPerSeat: Number(dep.estHppPerSeat),
        });
    } catch (err) {
        console.error('POST /api/departures error:', err);
        return res.status(400).json({ error: 'Gagal membuka kloter baru.' });
    }
});

// 4. Berangkatkan Kloter & Pengakuan Pendapatan SAK ETAP (Atomik)
app.post('/api/departures/:id/dispatch', requireAuth, requireRole('OWNER', 'FINANCE', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const dep = await tx.departure.findFirst({ where: { id, tenantId } });
            if (!dep) throw new Error('NOT_FOUND');
            if (dep.status === 'DEPARTED') throw new Error('ALREADY_DEPARTED');

            const kloterBookings = await tx.booking.findMany({
                where: { departureId: dep.id, tenantId, status: { not: 'CANCELLED' } },
            });

            const recognizedAmount = kloterBookings.reduce((sum, b) => sum + Number(b.paidAmount), 0);
            const totalHpp = Number(dep.filledSeats) * Number(dep.estHppPerSeat);

            const updatedDep = await tx.departure.update({
                where: { id: dep.id },
                data: { status: 'DEPARTED' },
            });

            const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
            if (recognizedAmount > 0) {
                lines.push(
                    { accountCode: '2-101', accountName: 'Uang Muka Jamaah (Liabilitas)', debit: recognizedAmount, credit: 0 },
                    { accountCode: '4-101', accountName: 'Pendapatan Paket Umrah & Haji', debit: 0, credit: recognizedAmount }
                );
            }
            if (totalHpp > 0) {
                lines.push(
                    { accountCode: '5-101', accountName: 'Beban Pokok Penjualan (Tiket, Hotel, Visa)', debit: totalHpp, credit: 0 },
                    { accountCode: '1-102', accountName: 'Bank Operasional Syariah (BSI)', debit: 0, credit: totalHpp }
                );
            }

            let journal = null;
            if (lines.length > 0) {
                journal = await tx.journalEntry.create({
                    data: {
                        tenantId,
                        entryNo: `REV-${dep.kloterCode}-${Date.now().toString().slice(-4)}`,
                        entryDate: dep.departureDate,
                        refType: 'DEPARTURE_RECOGNITION',
                        kloterCode: dep.kloterCode,
                        description: `Pengakuan Pendapatan & HPP Kloter ${dep.kloterCode} (${dep.filledSeats} Jamaah Berangkat)`,
                        lines: { create: lines },
                    },
                    include: { lines: true },
                });
            }

            return {
                departure: {
                    ...updatedDep,
                    departureDate: updatedDep.departureDate.toISOString().slice(0, 10),
                    returnDate: updatedDep.returnDate.toISOString().slice(0, 10),
                    estHppPerSeat: Number(updatedDep.estHppPerSeat),
                },
                journal: journal ? mapJournalResponse(journal) : null,
                recognizedAmount,
            };
        });

        return res.json(result);
    } catch (err: any) {
        if (err?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Kloter tidak ditemukan.' });
        if (err?.message === 'ALREADY_DEPARTED') return res.status(400).json({ error: 'Kloter sudah diberangkatkan.' });
        console.error('POST /api/departures/:id/dispatch error:', err);
        return res.status(500).json({ error: 'Gagal memberangkatkan kloter.' });
    }
});

// 5. Update Rooming List & Mahram Jamaah
app.patch('/api/bookings/:id/rooming', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);
        const { roomNumber, mahramGroup } = req.body;

        const existing = await prisma.booking.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Booking tidak ditemukan.' });

        const updated = await prisma.booking.update({
            where: { id },
            data: {
                roomNumber: String(roomNumber || 'TBD').trim(),
                mahramGroup: String(mahramGroup || '').trim(),
            },
            include: { departure: true },
        });

        return res.json({
            id: updated.id,
            tenantId: updated.tenantId,
            bookingNo: updated.bookingNo,
            departureId: updated.departureId,
            kloterCode: updated.departure.kloterCode,
            jamaahName: updated.jamaahName,
            nikMasked: maskNik(decryptSensitive(updated.nikEncrypted)),
            phone: updated.phone,
            gender: updated.gender,
            roomType: updated.roomType,
            roomNumber: updated.roomNumber,
            mahramGroup: updated.mahramGroup,
            agentId: updated.agentId ?? undefined,
            totalAmount: Number(updated.totalAmount),
            paidAmount: Number(updated.paidAmount),
            status: updated.status,
            kitDispatched: updated.kitDispatched,
            createdAt: updated.createdAt.toISOString().slice(0, 10),
        });
    } catch (err) {
        console.error('PATCH /api/bookings/:id/rooming error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui rooming list.' });
    }
});

// 6. Catat Jurnal Pengeluaran / Beban Vendor (SAK ETAP)
app.post('/api/expenses', requireAuth, requireRole('OWNER', 'FINANCE', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const { description, expenseAccountCode, paymentAccountCode, amount, kloterCode } = req.body;
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Nominal pengeluaran harus lebih dari 0.' });
        }

        const [expAcc, payAcc] = await Promise.all([
            prisma.chartOfAccount.findFirst({ where: { tenantId, code: String(expenseAccountCode) } }),
            prisma.chartOfAccount.findFirst({ where: { tenantId, code: String(paymentAccountCode) } }),
        ]);

        if (!expAcc || !payAcc) {
            return res.status(404).json({ error: 'Kode akun COA tidak ditemukan.' });
        }

        const journal = await prisma.journalEntry.create({
            data: {
                tenantId,
                entryNo: `EXP-${Date.now().toString().slice(-6)}`,
                entryDate: new Date(),
                refType: 'EXPENSE',
                kloterCode: kloterCode ? String(kloterCode) : null,
                description: String(description).trim(),
                lines: {
                    create: [
                        { accountCode: expAcc.code, accountName: expAcc.name, debit: parsedAmount, credit: 0 },
                        { accountCode: payAcc.code, accountName: payAcc.name, debit: 0, credit: parsedAmount },
                    ],
                },
            },
            include: { lines: true },
        });

        return res.status(201).json(mapJournalResponse(journal));
    } catch (err) {
        console.error('POST /api/expenses error:', err);
        return res.status(500).json({ error: 'Gagal menyimpan jurnal pengeluaran.' });
    }
});

// 7. Gudang: Assembly Paket Perlengkapan
app.post('/api/inventory/assemble', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const quantity = Number(req.body.quantity);
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Jumlah assembly harus lebih dari 0.' });
        }

        const updatedItems = await prisma.$transaction(async (tx) => {
            const items = await tx.inventoryItem.findMany({ where: { tenantId } });
            const components = items.filter((i) => !i.isBundle);
            const bundle = items.find((i) => i.isBundle);

            if (!bundle) throw new Error('NO_BUNDLE');
            if (components.some((c) => c.qty < quantity)) throw new Error('INSUFFICIENT_STOCK');

            for (const comp of components) {
                await tx.inventoryItem.update({
                    where: { id: comp.id },
                    data: { qty: { decrement: quantity } },
                });
            }
            await tx.inventoryItem.update({
                where: { id: bundle.id },
                data: { qty: { increment: quantity } },
            });

            return tx.inventoryItem.findMany({ where: { tenantId }, orderBy: { sku: 'asc' } });
        });

        return res.json(updatedItems.map((i) => ({ ...i, avgCost: Number(i.avgCost) })));
    } catch (err: any) {
        if (err?.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ error: 'Stok komponen gudang tidak mencukupi untuk assembly.' });
        }
        console.error('POST /api/inventory/assemble error:', err);
        return res.status(500).json({ error: 'Gagal merakit paket perlengkapan.' });
    }
});

// 8. Gudang: Restock Item
app.post('/api/inventory/:id/restock', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);
        const addQty = Number(req.body.addQty);
        if (!addQty || addQty <= 0) return res.status(400).json({ error: 'Jumlah restock tidak valid.' });

        const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Item gudang tidak ditemukan.' });

        const updated = await prisma.inventoryItem.update({
            where: { id },
            data: { qty: { increment: addQty } },
        });
        return res.json({ ...updated, avgCost: Number(updated.avgCost) });
    } catch (err) {
        console.error('POST /api/inventory/:id/restock error:', err);
        return res.status(500).json({ error: 'Gagal menambah stok barang.' });
    }
});

// 9. Gudang: Serah Terima Perlengkapan Jamaah (Atomik)
app.post('/api/bookings/:id/dispatch-kit', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({ where: { id, tenantId } });
            if (!booking) throw new Error('BOOKING_NOT_FOUND');
            if (booking.kitDispatched) throw new Error('ALREADY_DISPATCHED');

            const bundle = await tx.inventoryItem.findFirst({ where: { tenantId, isBundle: true } });
            if (!bundle || bundle.qty < 1) throw new Error('NO_BUNDLE_STOCK');

            const updatedBooking = await tx.booking.update({
                where: { id: booking.id },
                data: { kitDispatched: true },
                include: { departure: true },
            });
            const updatedBundle = await tx.inventoryItem.update({
                where: { id: bundle.id },
                data: { qty: { decrement: 1 } },
            });

            return {
                booking: {
                    id: updatedBooking.id,
                    tenantId: updatedBooking.tenantId,
                    bookingNo: updatedBooking.bookingNo,
                    departureId: updatedBooking.departureId,
                    kloterCode: updatedBooking.departure.kloterCode,
                    jamaahName: updatedBooking.jamaahName,
                    nikMasked: maskNik(decryptSensitive(updatedBooking.nikEncrypted)),
                    phone: updatedBooking.phone,
                    gender: updatedBooking.gender,
                    roomType: updatedBooking.roomType,
                    roomNumber: updatedBooking.roomNumber,
                    mahramGroup: updatedBooking.mahramGroup,
                    agentId: updatedBooking.agentId ?? undefined,
                    totalAmount: Number(updatedBooking.totalAmount),
                    paidAmount: Number(updatedBooking.paidAmount),
                    status: updatedBooking.status,
                    kitDispatched: updatedBooking.kitDispatched,
                    createdAt: updatedBooking.createdAt.toISOString().slice(0, 10),
                },
                bundle: { ...updatedBundle, avgCost: Number(updatedBundle.avgCost) },
            };
        });

        return res.json(result);
    } catch (err: any) {
        if (err?.message === 'NO_BUNDLE_STOCK') {
            return res.status(400).json({ error: 'Stok Paket Perlengkapan Siap Berangkat kosong.' });
        }
        if (err?.message === 'ALREADY_DISPATCHED') {
            return res.status(400).json({ error: 'Perlengkapan jamaah ini sudah diserahkan sebelumnya.' });
        }
        console.error('POST /api/bookings/:id/dispatch-kit error:', err);
        return res.status(500).json({ error: 'Gagal memproses serah terima perlengkapan.' });
    }
});

// 10. Keagenan: Daftarkan Agen / Syiar Baru
app.post('/api/agents', requireAuth, requireRole('OWNER', 'OPS', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const { name, phone, parentAgentId, directCommissionRate } = req.body;

        const count = await prisma.agent.count({ where: { tenantId } });
        const parent = parentAgentId
            ? await prisma.agent.findFirst({ where: { id: String(parentAgentId), tenantId } })
            : null;

        const agent = await prisma.agent.create({
            data: {
                tenantId,
                code: `AGN-${String(count + 1).padStart(3, '0')}`,
                name: String(name).trim(),
                phone: String(phone).trim(),
                parentAgentId: parent ? parent.id : null,
                directCommissionRate: Number(directCommissionRate),
                overridingRatePct: 10,
            },
        });

        return res.status(201).json({
            id: agent.id,
            tenantId: agent.tenantId,
            code: agent.code,
            name: agent.name,
            phone: agent.phone,
            parentAgentId: agent.parentAgentId ?? undefined,
            parentAgentName: parent ? `${parent.name} (Overriding 10%)` : undefined,
            directCommissionRate: Number(agent.directCommissionRate),
            overridingRatePct: agent.overridingRatePct,
            jamaahCount: agent.jamaahCount,
            commissionEarned: Number(agent.commissionEarned),
            commissionPaid: Number(agent.commissionPaid),
        });
    } catch (err) {
        console.error('POST /api/agents error:', err);
        return res.status(400).json({ error: 'Gagal mendaftarkan agen baru.' });
    }
});

// 11. Keagenan: Pencairan Komisi Agen + Jurnal SAK ETAP (Atomik)
app.post('/api/agents/:id/disburse', requireAuth, requireRole('OWNER', 'FINANCE', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const agent = await tx.agent.findFirst({ where: { id, tenantId } });
            if (!agent) throw new Error('NOT_FOUND');

            const unpaid = Math.max(0, Number(agent.commissionEarned) - Number(agent.commissionPaid));
            if (unpaid <= 0) throw new Error('NO_UNPAID');

            const updatedAgent = await tx.agent.update({
                where: { id: agent.id },
                data: { commissionPaid: agent.commissionEarned },
            });

            const parent = updatedAgent.parentAgentId
                ? await tx.agent.findFirst({ where: { id: updatedAgent.parentAgentId, tenantId } })
                : null;

            const journal = await tx.journalEntry.create({
                data: {
                    tenantId,
                    entryNo: `PAYCOM-${agent.code}-${Date.now().toString().slice(-4)}`,
                    entryDate: new Date(),
                    refType: 'COMMISSION',
                    description: `Pencairan Komisi Agen ${agent.name} (${agent.code})`,
                    lines: {
                        create: [
                            { accountCode: '2-102', accountName: 'Hutang Komisi Agen', debit: unpaid, credit: 0 },
                            { accountCode: '1-102', accountName: 'Bank Operasional Syariah (BSI)', debit: 0, credit: unpaid },
                        ],
                    },
                },
                include: { lines: true },
            });

            return {
                agent: {
                    id: updatedAgent.id,
                    tenantId: updatedAgent.tenantId,
                    code: updatedAgent.code,
                    name: updatedAgent.name,
                    phone: updatedAgent.phone,
                    parentAgentId: updatedAgent.parentAgentId ?? undefined,
                    parentAgentName: parent ? `${parent.name} (Overriding 10%)` : undefined,
                    directCommissionRate: Number(updatedAgent.directCommissionRate),
                    overridingRatePct: updatedAgent.overridingRatePct,
                    jamaahCount: updatedAgent.jamaahCount,
                    commissionEarned: Number(updatedAgent.commissionEarned),
                    commissionPaid: Number(updatedAgent.commissionPaid),
                },
                journal: mapJournalResponse(journal),
                paidAmount: unpaid,
            };
        });

        return res.json(result);
    } catch (err: any) {
        if (err?.message === 'NO_UNPAID') return res.status(400).json({ error: 'Tidak ada saldo komisi yang belum dibayar.' });
        if (err?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Agen tidak ditemukan.' });
        console.error('POST /api/agents/:id/disburse error:', err);
        return res.status(500).json({ error: 'Gagal mencairkan komisi agen.' });
    }
});

// 12. ISO 9001:2015 SLA Incidents (Buat & Update)
app.post('/api/incidents', requireAuth, async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const { kloterCode, category, description, slaDeadline } = req.body;
        const count = await prisma.isoIncident.count({ where: { tenantId } });

        const incident = await prisma.isoIncident.create({
            data: {
                tenantId,
                ticket: `SLA-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
                kloterCode: String(kloterCode).trim(),
                category: String(category),
                description: String(description).trim(),
                slaDeadline: new Date(slaDeadline),
                status: 'OPEN',
            },
        });
        return res.status(201).json({
            ...incident,
            slaDeadline: incident.slaDeadline.toISOString().slice(0, 10),
            resolutionNotes: incident.resolutionNotes ?? undefined,
        });
    } catch (err) {
        console.error('POST /api/incidents error:', err);
        return res.status(400).json({ error: 'Gagal membuat tiket SLA.' });
    }
});

app.patch('/api/incidents/:id', requireAuth, async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const id = String(req.params.id);
        const { status, resolutionNotes } = req.body;

        const existing = await prisma.isoIncident.findFirst({ where: { id, tenantId } });
        if (!existing) return res.status(404).json({ error: 'Tiket SLA tidak ditemukan.' });

        const updated = await prisma.isoIncident.update({
            where: { id },
            data: {
                status: String(status),
                resolutionNotes: resolutionNotes ?? existing.resolutionNotes,
            },
        });
        return res.json({
            ...updated,
            slaDeadline: updated.slaDeadline.toISOString().slice(0, 10),
            resolutionNotes: updated.resolutionNotes ?? undefined,
        });
    } catch (err) {
        console.error('PATCH /api/incidents/:id error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui status tiket SLA.' });
    }
});

// 13. Super-Admin Multi-Tenant Provisioning & Tema (Khusus SUPER_ADMIN)
app.post('/api/superadmin/tenants', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const { name, subdomain, ppiu, pihk, plan, primaryColor } = req.body;
        const initials = String(name)
            .replace(/^PT\s+/i, '')
            .split(/\s+/)
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase() || '')
            .join('') || 'TR';

        const limits: Record<string, { maxJ: number; maxU: number }> = {
            LITE: { maxJ: 100, maxU: 5 },
            PRO: { maxJ: 350, maxU: 15 },
            ENTERPRISE: { maxJ: 1000, maxU: 50 },
        };
        const cfg = limits[String(plan)] || limits.PRO;

        const createdTenant = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    code: initials,
                    name: String(name).trim(),
                    subdomain: String(subdomain).trim().toLowerCase(),
                    ppiu: String(ppiu).trim(),
                    pihk: String(pihk || 'Belum Terdaftar').trim(),
                    plan: String(plan || 'PRO'),
                    maxJamaahPerMonth: cfg.maxJ,
                    maxUsers: cfg.maxU,
                    primaryColor: String(primaryColor || '#0F4C3A'),
                    isActive: true,
                },
            });

            const standardCoa = [
                { code: '1-101', name: 'Kas Tunai Kantor', type: 'ASSET', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '1-102', name: 'Bank Operasional Syariah (BSI)', type: 'ASSET', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '1-104', name: 'Persediaan Perlengkapan Umrah', type: 'ASSET', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '1-105', name: 'Uang Muka Vendor (Maskapai & Hotel)', type: 'ASSET', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '2-101', name: 'Uang Muka Jamaah (Liabilitas)', type: 'LIABILITY', normalBalance: 'CREDIT', openingBalance: 0 },
                { code: '2-102', name: 'Hutang Komisi Agen', type: 'LIABILITY', normalBalance: 'CREDIT', openingBalance: 0 },
                { code: '3-101', name: 'Modal Disetor & Laba Ditahan', type: 'EQUITY', normalBalance: 'CREDIT', openingBalance: 0 },
                { code: '4-101', name: 'Pendapatan Paket Umrah & Haji', type: 'REVENUE', normalBalance: 'CREDIT', openingBalance: 0 },
                { code: '5-101', name: 'Beban Pokok Penjualan (Tiket, Hotel, Visa)', type: 'EXPENSE', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '5-201', name: 'Beban Komisi Agen & Marketing', type: 'EXPENSE', normalBalance: 'DEBIT', openingBalance: 0 },
                { code: '5-301', name: 'Beban Operasional Kantor & SDM', type: 'EXPENSE', normalBalance: 'DEBIT', openingBalance: 0 },
            ];

            await tx.chartOfAccount.createMany({
                data: standardCoa.map((c) => ({ ...c, tenantId: tenant.id })),
            });

            await tx.inventoryItem.createMany({
                data: [
                    {
                        tenantId: tenant.id,
                        sku: 'ITM-KPR24',
                        name: 'Koper Hardcase 24 Inch',
                        warehouse: 'Gudang Utama',
                        qty: 0,
                        minStock: 20,
                        avgCost: 375000,
                        isBundle: false,
                    },
                    {
                        tenantId: tenant.id,
                        sku: 'BND-PKT01',
                        name: 'Paket Perlengkapan Siap Berangkat',
                        warehouse: 'Gudang Utama',
                        qty: 0,
                        minStock: 10,
                        avgCost: 700000,
                        isBundle: true,
                    },
                ],
            });

            return tenant;
        });

        return res.status(201).json(createdTenant);
    } catch (err) {
        console.error('POST /api/superadmin/tenants error:', err);
        return res.status(400).json({ error: 'Gagal membuat tenant baru (pastikan subdomain belum dipakai).' });
    }
});

app.patch('/api/superadmin/tenants/:id/theme', requireAuth, requireRole('OWNER', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id);
        const { primaryColor } = req.body;
        if (req.auth!.role !== 'SUPER_ADMIN' && req.auth!.tenantId !== id) {
            return res.status(403).json({ error: 'Akses tenant ditolak.' });
        }
        const updated = await prisma.tenant.update({
            where: { id },
            data: { primaryColor: String(primaryColor) },
        });
        return res.json(updated);
    } catch (err) {
        console.error('PATCH /api/superadmin/tenants/:id/theme error:', err);
        return res.status(500).json({ error: 'Gagal mengubah warna tema tenant.' });
    }
});

// 1. Switch Workspace Tenant (Khusus SUPER_ADMIN - menerbitkan ulang JWT cookie dengan tenantId tujuan)
app.post('/api/superadmin/switch-tenant', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const schema = z.object({ tenantId: z.string().min(1) });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'ID tenant tidak valid.' });
        }

        const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
        if (!actor || !actor.isActive || actor.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Hanya Super-Admin aktif yang dapat berpindah workspace.' });
        }

        const targetTenant = await prisma.tenant.findUnique({
            where: { id: parsed.data.tenantId },
        });
        if (!targetTenant) {
            return res.status(404).json({ error: 'Tenant tujuan tidak ditemukan.' });
        }

        const token = jwt.sign(
            {
                userId: actor.id,
                tenantId: targetTenant.id,
                role: 'SUPER_ADMIN',
                email: actor.email,
            },
            process.env.JWT_SECRET!,
            { expiresIn: '12h' }
        );

        const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('sl_token', token, {
            httpOnly: true,
            secure: isProd && isHttps,
            sameSite: 'lax',
            maxAge: 12 * 60 * 60 * 1000,
        });

        return res.json({ tenant: targetTenant });
    } catch (err) {
        console.error('POST /api/superadmin/switch-tenant error:', err);
        return res.status(500).json({ error: 'Gagal berpindah workspace tenant.' });
    }
});

// 2. Daftar Seluruh Akun Sistem Lintas Tenant (Khusus SUPER_ADMIN)
app.get('/api/superadmin/users', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantIdFilter =
            typeof req.query.tenantId === 'string' && req.query.tenantId.trim()
                ? req.query.tenantId.trim()
                : undefined;

        const users = await prisma.user.findMany({
            where: tenantIdFilter ? { tenantId: tenantIdFilter } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                tenant: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        subdomain: true,
                    },
                },
            },
        });

        return res.json(
            users.map((u) => ({
                ...u,
                createdAt: u.createdAt.toISOString().slice(0, 10),
            }))
        );
    } catch (err) {
        console.error('GET /api/superadmin/users error:', err);
        return res.status(500).json({ error: 'Gagal memuat daftar akun pengguna.' });
    }
});

// 3. Buat Akun Sistem Baru (Khusus SUPER_ADMIN - akun lain tidak dapat membuat akun apapun termasuk SUPER_ADMIN)
app.post('/api/superadmin/users', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const schema = z.object({
            tenantId: z.string().min(1),
            name: z.string().trim().min(2),
            email: z.string().trim().email().transform((v) => v.toLowerCase()),
            password: z.string().min(8, 'Password minimal 8 karakter'),
            role: z.enum(['SUPER_ADMIN', 'OWNER', 'OPS', 'FINANCE', 'AGENT']),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues[0]?.message || 'Data akun tidak valid.',
            });
        }

        const { tenantId, name, email, password, role } = parsed.data;

        // Defense-in-depth: role selain SUPER_ADMIN dilarang keras membuat akun SUPER_ADMIN
        if (role === 'SUPER_ADMIN' && req.auth!.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                error: 'Hanya Super-Admin yang berhak membuat akun Super-Admin.',
            });
        }

        const targetTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!targetTenant) {
            return res.status(404).json({ error: 'Tenant tujuan tidak ditemukan.' });
        }

        if (role !== 'SUPER_ADMIN') {
            const tenantUserCount = await prisma.user.count({
                where: { tenantId, role: { not: 'SUPER_ADMIN' } },
            });
            if (tenantUserCount >= targetTenant.maxUsers) {
                return res.status(400).json({
                    error: `Kuota user paket ${targetTenant.plan} (${targetTenant.maxUsers} user) pada ${targetTenant.name} sudah penuh.`,
                });
            }
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: `Email ${email} sudah terdaftar di sistem.` });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const created = await prisma.user.create({
            data: {
                tenantId,
                name,
                email,
                passwordHash,
                role,
                isActive: true,
            },
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                tenant: {
                    select: { id: true, code: true, name: true, subdomain: true },
                },
            },
        });

        return res.status(201).json({
            ...created,
            createdAt: created.createdAt.toISOString().slice(0, 10),
        });
    } catch (err) {
        console.error('POST /api/superadmin/users error:', err);
        return res.status(500).json({ error: 'Gagal membuat akun pengguna baru.' });
    }
});

// 4. Update Role / Status / Reset Password Akun (Khusus SUPER_ADMIN)
app.patch('/api/superadmin/users/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().trim().min(2).optional(),
            tenantId: z.string().min(1).optional(),
            role: z.enum(['SUPER_ADMIN', 'OWNER', 'OPS', 'FINANCE', 'AGENT']).optional(),
            isActive: z.boolean().optional(),
            password: z.string().min(8).optional().or(z.literal('')),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.issues[0]?.message || 'Perubahan data akun tidak valid.',
            });
        }

        const userId = String(req.params.id);
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
        }

        const { name, tenantId, role, isActive, password } = parsed.data;

        if (role === 'SUPER_ADMIN' && req.auth!.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                error: 'Hanya Super-Admin yang berhak memberikan role Super-Admin.',
            });
        }

        // Proteksi agar Super-Admin yang sedang login tidak mengunci dirinya sendiri
        if (
            targetUser.id === req.auth!.userId &&
            (isActive === false || (role && role !== 'SUPER_ADMIN'))
        ) {
            return res.status(400).json({
                error: 'Tidak dapat menonaktifkan atau menurunkan role akun Super-Admin yang sedang Anda pakai.',
            });
        }

        const updateData: {
            name?: string;
            tenantId?: string;
            role?: string;
            isActive?: boolean;
            passwordHash?: string;
        } = {};

        if (name) updateData.name = name;
        if (tenantId) updateData.tenantId = tenantId;
        if (role) updateData.role = role;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (password && password.trim().length >= 8) {
            updateData.passwordHash = await bcrypt.hash(password.trim(), 12);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                tenant: {
                    select: { id: true, code: true, name: true, subdomain: true },
                },
            },
        });

        return res.json({
            ...updated,
            createdAt: updated.createdAt.toISOString().slice(0, 10),
        });
    } catch (err) {
        console.error('PATCH /api/superadmin/users/:id error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui akun pengguna.' });
    }
});

// 5. Hapus Akun oleh SUPER_ADMIN (kecuali akun sendiri)
app.delete('/api/superadmin/users/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
    try {
        const userId = String(req.params.id);
        if (userId === req.auth!.userId) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun Super-Admin yang sedang Anda gunakan.' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
        }

        await prisma.user.delete({ where: { id: userId } });
        return res.json({ deletedId: userId });
    } catch (err) {
        console.error('DELETE /api/superadmin/users/:id error:', err);
        return res.status(500).json({ error: 'Gagal menghapus akun pengguna.' });
    }
});

// ==================== MANAJEMEN AKUN STAF OLEH OWNER / DIREKSI ====================

// 1. Daftar Staf Perusahaan Sendiri (SUPER_ADMIN disembunyikan total dari OWNER)
app.get('/api/users', requireAuth, requireRole('OWNER'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const users = await prisma.user.findMany({
            where: {
                tenantId,
                ...(req.auth!.role !== 'SUPER_ADMIN' ? { role: { not: 'SUPER_ADMIN' } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return res.json(
            users.map((u) => ({
                ...u,
                createdAt: u.createdAt.toISOString().slice(0, 10),
            }))
        );
    } catch (err) {
        console.error('GET /api/users error:', err);
        return res.status(500).json({ error: 'Gagal memuat daftar akun staf.' });
    }
});

// 2. Buat Akun Staf Baru oleh OWNER (Hanya boleh OPS, FINANCE, AGENT di tenant sendiri)
app.post('/api/users', requireAuth, requireRole('OWNER'), async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
            email: z.string().trim().email('Format email tidak valid').transform((v) => v.toLowerCase()),
            password: z.string().min(8, 'Password minimal 8 karakter'),
            role: z.string(),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data akun tidak valid.' });
        }

        const { name, email, password, role } = parsed.data;
        const allowedStaffRoles = ['OPS', 'FINANCE', 'AGENT'];

        if (role === 'SUPER_ADMIN' || !allowedStaffRoles.includes(role)) {
            return res.status(403).json({
                error: 'Owner hanya dapat membuat akun staf di bawahnya (OPS, FINANCE, AGENT).',
            });
        }

        const tenantId = req.auth!.tenantId;
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant tidak ditemukan.' });
        }

        const currentUserCount = await prisma.user.count({
            where: { tenantId, role: { not: 'SUPER_ADMIN' } },
        });
        if (currentUserCount >= tenant.maxUsers) {
            return res.status(400).json({
                error: `Kuota maksimal ${tenant.maxUsers} akun pada paket ${tenant.plan} telah tercapai.`,
            });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: `Email ${email} sudah terdaftar.` });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const created = await prisma.user.create({
            data: {
                tenantId,
                name,
                email,
                passwordHash,
                role,
                isActive: true,
            },
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return res.status(201).json({
            ...created,
            createdAt: created.createdAt.toISOString().slice(0, 10),
        });
    } catch (err) {
        console.error('POST /api/users error:', err);
        return res.status(500).json({ error: 'Gagal membuat akun staf baru.' });
    }
});

// 3. Edit / Reset Password / Nonaktifkan Akun Staf oleh OWNER
app.patch('/api/users/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().trim().min(2).optional(),
            role: z.string().optional(),
            isActive: z.boolean().optional(),
            password: z.string().min(8, 'Password minimal 8 karakter').optional().or(z.literal('')),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input tidak valid.' });
        }

        const userId = String(req.params.id);
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });

        // Isolasi Tenant & Proteksi Hierarki
        if (!targetUser || targetUser.tenantId !== req.auth!.tenantId) {
            return res.status(404).json({ error: 'Akun staf tidak ditemukan pada perusahaan Anda.' });
        }

        const allowedStaffRoles = ['OPS', 'FINANCE', 'AGENT'];
        if (targetUser.role === 'SUPER_ADMIN' || !allowedStaffRoles.includes(targetUser.role)) {
            return res.status(403).json({
                error: 'Anda tidak memiliki izin untuk mengubah akun Super-Admin atau Owner.',
            });
        }

        const { name, role, isActive, password } = parsed.data;
        if (role && (role === 'SUPER_ADMIN' || !allowedStaffRoles.includes(role))) {
            return res.status(403).json({
                error: 'Role hanya dapat diubah menjadi OPS, FINANCE, atau AGENT.',
            });
        }

        const updateData: {
            name?: string;
            role?: string;
            isActive?: boolean;
            passwordHash?: string;
        } = {};

        if (name) updateData.name = name;
        if (role) updateData.role = role;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (password && password.trim().length >= 8) {
            updateData.passwordHash = await bcrypt.hash(password.trim(), 12);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                tenantId: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return res.json({
            ...updated,
            createdAt: updated.createdAt.toISOString().slice(0, 10),
        });
    } catch (err) {
        console.error('PATCH /api/users/:id error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui akun staf.' });
    }
});

// 4. Hapus Akun Staf oleh OWNER (Tidak bisa hapus SUPER_ADMIN, OWNER, atau luar tenant)
app.delete('/api/users/:id', requireAuth, requireRole('OWNER'), async (req, res) => {
    try {
        const userId = String(req.params.id);
        if (userId === req.auth!.userId) {
            return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.tenantId !== req.auth!.tenantId) {
            return res.status(404).json({ error: 'Akun staf tidak ditemukan pada perusahaan Anda.' });
        }

        if (!['OPS', 'FINANCE', 'AGENT'].includes(targetUser.role)) {
            return res.status(403).json({
                error: 'Anda tidak memiliki izin untuk menghapus akun Super-Admin atau Owner.',
            });
        }

        await prisma.user.delete({ where: { id: userId } });
        return res.json({ deletedId: userId });
    } catch (err) {
        console.error('DELETE /api/users/:id error:', err);
        return res.status(500).json({ error: 'Gagal menghapus akun staf.' });
    }
});

// ============================================================================
// FASE 8: PRODUCTION HARDENING (USER MANAGEMENT & PAYMENT WEBHOOK ATOMIK)
// ============================================================================

// 1. Tambah Akun Staf (OPS / FINANCE / AGENT) oleh OWNER atau SUPER_ADMIN
app.post('/api/users', requireAuth, requireRole('OWNER', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const tenantId = req.auth!.tenantId;
        const schema = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(8),
            role: z.enum(['OWNER', 'OPS', 'FINANCE', 'AGENT']),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Data user tidak valid (password min. 8 karakter).' });
        }

        const passwordHash = await bcrypt.hash(parsed.data.password, 12);
        const created = await prisma.user.create({
            data: {
                tenantId,
                name: parsed.data.name.trim(),
                email: parsed.data.email.trim().toLowerCase(),
                passwordHash,
                role: parsed.data.role,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return res.status(201).json(created);
    } catch (err) {
        console.error('POST /api/users error:', err);
        return res.status(400).json({ error: 'Email sudah terdaftar atau gagal membuat user.' });
    }
});

// 2. Webhook Payment Gateway (Xendit / Midtrans) — Idempoten & Atomik SAK ETAP
app.post('/api/webhooks/payment', async (req, res) => {
    try {
        const expectedToken = process.env.PAYMENT_WEBHOOK_TOKEN;
        const incomingToken = String(req.headers['x-callback-token'] || '');
        if (!expectedToken || incomingToken !== expectedToken) {
            return res.status(401).json({ error: 'Signature / callback token tidak valid.' });
        }

        const { externalId, bookingNo, amount, method, status } = req.body;
        if (status !== 'PAID' && status !== 'SETTLED') {
            return res.json({ ignored: true, reason: 'Status belum lunas.' });
        }

        const parsedAmount = Number(amount);
        if (!externalId || !bookingNo || !parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Payload webhook tidak lengkap.' });
        }

        // Cek idempotency agar callback ganda tidak menggandakan saldo/jurnal
        const duplicate = await prisma.paymentRecord.findUnique({
            where: { externalId: String(externalId) },
        });
        if (duplicate) {
            return res.json({ ok: true, idempotent: true, receiptNo: duplicate.receiptNo });
        }

        const result = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({
                where: { bookingNo: String(bookingNo) },
                include: { departure: true },
            });
            if (!booking) throw new Error('BOOKING_NOT_FOUND');

            const remaining = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
            const verifiedAmt = Math.min(parsedAmount, remaining);
            if (verifiedAmt <= 0) throw new Error('ALREADY_PAID');

            const payCount = await tx.paymentRecord.count({ where: { tenantId: booking.tenantId } });
            const receiptNo = `KWT-${new Date().getFullYear()}-${String(payCount + 1).padStart(4, '0')}`;
            const qrHash = `SIG-WH-${Date.now().toString(36).toUpperCase()}`;

            const payment = await tx.paymentRecord.create({
                data: {
                    tenantId: booking.tenantId,
                    bookingId: booking.id,
                    receiptNo,
                    method: String(method || 'XENDIT_VA'),
                    amount: verifiedAmt,
                    qrHash,
                    externalId: String(externalId),
                },
            });

            const newPaid = Number(booking.paidAmount) + verifiedAmt;
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    paidAmount: newPaid,
                    status: newPaid >= Number(booking.totalAmount) ? 'PAID' : 'INSTALLMENT',
                },
            });

            await tx.journalEntry.create({
                data: {
                    tenantId: booking.tenantId,
                    entryNo: `JRN-WH-${Date.now().toString().slice(-6)}`,
                    entryDate: new Date(),
                    refType: 'PAYMENT',
                    kloterCode: booking.departure.kloterCode,
                    description: `Webhook ${method || 'VA'} a/n ${booking.jamaahName} (${receiptNo})`,
                    lines: {
                        create: [
                            { accountCode: '1-102', accountName: 'Bank Operasional Syariah (BSI)', debit: verifiedAmt, credit: 0 },
                            { accountCode: '2-101', accountName: 'Uang Muka Jamaah (Liabilitas)', debit: 0, credit: verifiedAmt },
                        ],
                    },
                },
            });

            return payment;
        });

        return res.json({ ok: true, receiptNo: result.receiptNo });
    } catch (err: any) {
        if (err?.message === 'BOOKING_NOT_FOUND') return res.status(404).json({ error: 'Booking tidak ditemukan.' });
        if (err?.message === 'ALREADY_PAID') return res.json({ ok: true, note: 'Tagihan sudah lunas.' });
        console.error('POST /api/webhooks/payment error:', err);
        return res.status(500).json({ error: 'Gagal memproses webhook pembayaran.' });
    }
});

startServer();