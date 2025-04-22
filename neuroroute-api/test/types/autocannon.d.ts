declare module 'autocannon' {
  export interface Result {
    requests: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      total: number;
      sent: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
    latency: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
    throughput: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      total: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
    errors: number;
    timeouts: number;
    duration: number;
    start: Date;
    finish: Date;
    connections: number;
    pipelining: number;
    non2xx: number;
    resets: number;
    title: string;
    url: string;
  }

  export interface Request {
    name?: string;
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  export interface Options {
    url?: string;
    socketPath?: string;
    connections?: number;
    duration?: number;
    amount?: number;
    timeout?: number;
    pipelining?: number;
    workers?: number;
    bailout?: number;
    method?: string;
    title?: string;
    body?: string | Buffer;
    headers?: Record<string, string>;
    requests?: Request[];
    idReplacement?: boolean;
    forever?: boolean;
    servername?: string;
    excludeErrorStats?: boolean;
    expectBody?: string | RegExp;
    expectStatusCode?: number;
    expectStatusCodes?: number[];
    renderProgressBar?: boolean;
    renderLatencyTable?: boolean;
    renderResultsTable?: boolean;
    json?: boolean;
    connectionRate?: number;
    overallRate?: number;
    ignoreCoordinatedOmission?: boolean;
    reconnectRate?: number;
    setupClient?: (client: any) => void;
    verifyBody?: (body: string) => boolean;
    verifyStatus?: (status: number) => boolean;
  }

  export default function autocannon(
    opts: Options | string,
    cb?: (err: Error | null, result: Result) => void
  ): any;

  export function track(instance: any, opts?: { renderProgressBar?: boolean }): any;
}