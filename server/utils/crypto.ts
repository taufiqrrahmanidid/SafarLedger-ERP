import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY || '';
    if (hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY wajib berupa 64 karakter hex (32 byte).');
    }
    return Buffer.from(hex, 'hex');
}

export function encryptSensitive(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}