/**
 * Better-Auth Catch-All-Route fuer Next.js App Router.
 *
 * Faengt alles unter `/api/auth/*` ab und delegiert an `auth.handler`.
 * Konkrete Werkzirkel-API (POST /api/v1/auth/magic-link, GET .../verify usw.)
 * wird in task-magic-link-endpoints als eigene Routen-Schicht oberhalb dieser
 * Basis-Integration gebaut.
 */

import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

export const { GET, POST } = toNextJsHandler(auth.handler);
