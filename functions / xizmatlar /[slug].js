// /xizmatlar/:slug — xizmat sahifasi (o'zbekcha)
import { serveService } from '../_lib/services.js';
export const onRequestGet = (ctx) => serveService(ctx, 'uz');
