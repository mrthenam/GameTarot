import type { IncomingMessage, ServerResponse } from 'node:http';

export function createApi(opts?: { dev?: boolean; dataDir?: string; log?: (msg: string) => void }): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
