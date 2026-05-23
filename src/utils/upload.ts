import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/logging';

// Direktori tujuan upload
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Pastikan direktori ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface UploadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export const uploadFile = async (file: File): Promise<UploadResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dapatkan ekstensi asli dari nama file
    const ext = path.extname(file.name);

    // Generate nama file unik
    const uniqueFileName = `${uuidv4()}${ext}`;
    const joinedPath = path.join(UPLOAD_DIR, uniqueFileName);
    
    // Normalize path untuk mencegah path traversal (misal: '..')
    const destinationPath = path.normalize(joinedPath);
    
    // Pastikan base path diakhiri dengan separator direktori untuk mencegah Partial Path Traversal
    const safeBaseDir = path.normalize(UPLOAD_DIR) + path.sep;
    
    // Verifikasi bahwa final destinationPath masih berada di dalam safeBaseDir
    if (!destinationPath.startsWith(safeBaseDir)) {
      throw new Error("Path file tidak valid!");
    }

    // Tulis ke lokal direktori
    fs.writeFileSync(destinationPath, buffer);

    logger.info(`File uploaded successfully: ${uniqueFileName}`);

    return {
      success: true,
      filePath: `/uploads/${uniqueFileName}`,
      fileName: uniqueFileName,
    };
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to upload file');
    return {
      success: false,
      error: error.message || 'Failed to upload file',
    };
  }
};
