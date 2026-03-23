interface AntiBanConfig {
    minDelay: number;
    maxDelay: number;
    burstLimit: number;
    burstDelay: number;
}
declare class AntiBanService {
    private configs;
    private counters;
    getConfig(instanceName: string): AntiBanConfig;
    setConfig(instanceName: string, config: Partial<AntiBanConfig>): void;
    /** Aplica delay anti-ban entre mensagens */
    applyDelay(instanceName: string, msgIndex: number, interval?: number): Promise<void>;
    resetCounter(instanceName: string): void;
    getStatus(instanceName: string): {
        count: number;
        config: AntiBanConfig;
    };
}
declare const _default: AntiBanService;
export default _default;
//# sourceMappingURL=antiban.service.d.ts.map