import { TextDecoder, TextEncoder } from 'util';

// jsdom has no TextEncoder/TextDecoder; every browser the app supports does (share links use them)
Object.assign(globalThis, { TextEncoder, TextDecoder });
