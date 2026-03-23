import { Server } from 'socket.io';
export declare function setupSocketServer(server: any): Server;
export declare function getIO(): Server;
/** Emite evento para um usuário específico */
export declare function emitToUser(userId: number, event: string, data: any): void;
/** Emite evento para uma sala de campanha */
export declare function emitToCampaign(campaignId: number, event: string, data: any): void;
//# sourceMappingURL=socket.server.d.ts.map