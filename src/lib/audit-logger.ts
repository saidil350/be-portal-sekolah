import { db } from "../db";
import { auditLogs } from "../db/schemas/payments";
import { logger } from "./logger";

export async function logAudit(
  actionType: string,
  entityId: string,
  metadata?: any,
  tx?: any
) {
  try {
    const metaStr = metadata ? JSON.stringify(metadata) : undefined;
    
    // Log to Pino
    logger.info({ actionType, entityId, metadata }, `[AUDIT] ${actionType}`);

    // Log to DB
    const insertObj = {
      actionType,
      entityId,
      metadata: metaStr,
    };

    if (tx) {
      await tx.insert(auditLogs).values(insertObj);
    } else {
      await db.insert(auditLogs).values(insertObj);
    }
  } catch (error) {
    logger.error({ err: error, actionType, entityId }, 'Failed to save audit log');
  }
}
