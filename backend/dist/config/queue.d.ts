import { Queue, Worker, QueueEvents } from 'bullmq';
export declare const QUEUES: {
    readonly SEND_MESSAGES: "send-messages";
    readonly SEND_MEDIA: "send-media";
    readonly WEBHOOKS: "webhooks";
    readonly SCHEDULER: "scheduler";
};
export declare function getQueue(name: string): Queue | null;
export declare function closeAllQueues(): Promise<void>;
export { Queue, Worker, QueueEvents };
//# sourceMappingURL=queue.d.ts.map