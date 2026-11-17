import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET = process.env.S3_BUCKET || 'safarledger-dms-private';

export async function createPresignedUploadUrl(
    objectKey: string,
    contentType: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
        ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 120 }); // Berlaku 2 menit
}

export async function createPresignedViewUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 60 }); // Berlaku 1 menit
}