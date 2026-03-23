/**
 * Worker de envio de mensagens — processa jobs da fila send-messages
 * Roda como processo separado para não bloquear o servidor HTTP
 */
import 'dotenv/config';
export interface SendMessageJob {
    campaignId: number;
    instanceName: string;
    phoneNumber: string;
    message: string;
    contactName?: string;
    userId: number;
    totalContacts: number;
    contactIndex: number;
    intervalMs: number;
}
//# sourceMappingURL=send.worker.d.ts.map