import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import structuredLogger from "../../core/logger/structuredLogger.js";

const s3Config = {
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true, // Required for Cloudflare R2 path-style addressing
};

const s3Client = new S3Client(s3Config);

class S3Service {
    /**
     * Generates a presigned URL for uploading a file to R2
     */
    static async getPresignedUrl(key, contentType) {
        const AVATAR_BUCKET = process.env.S3_AVATAR_BUCKET || "profile";
        
        const command = new PutObjectCommand({
            Bucket: AVATAR_BUCKET,
            Key: key,
            ContentType: contentType,
            // Disable SDK-level checksums for presigned URLs to avoid client-side header requirements
            ChecksumAlgorithm: undefined 
        });

        // URL expires in 15 minutes (900 seconds)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        
        // Public URL base
        const publicBase = process.env.S3_PUBLIC_URL || `https://${AVATAR_BUCKET}.${process.env.S3_ENDPOINT?.split('//')[1]}`;
        const fileUrl = `${publicBase}/${key}`;

        return { uploadUrl, fileUrl };
    }
}

export default S3Service;
