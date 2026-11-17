import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthContext {
    userId: string;
    tenantId: string;
    role: 'SUPER_ADMIN' | 'OWNER' | 'OPS' | 'FINANCE' | 'AGENT';
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.sl_token;
    if (!token) {
        return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
    }
    try {
        const secret = process.env.JWT_SECRET!;
        const decoded = jwt.verify(token, secret) as AuthContext;
        req.auth = decoded; // tenantId selalu berasal dari token terverifikasi, bukan body request
        return next();
    } catch {
        return res.status(401).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
    }
}

export function requireRole(...allowedRoles: AuthContext['role'][]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
        }
        if (req.auth.role === 'SUPER_ADMIN' || allowedRoles.includes(req.auth.role)) {
            return next();
        }
        return res.status(403).json({ error: 'Anda tidak memiliki izin untuk aksi ini.' });
    };
}