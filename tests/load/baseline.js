/**
 * Werkzirkel — k6-Baseline-Lasttest.
 *
 * PRD §38 (Lasttest k6) + §42 Sprint 14 (Pre-Launch-QA).
 *
 * Lastprofil: 200 VUs ueber 5 Minuten (ramp-up 30s, plateau 4 min, ramp-down
 * 30s). Trifft die wichtigsten Public-Routen + die einzige public Schreib-
 * Operation (Magic-Link-Anfrage — gerate-limitet auf 5/h pro Mail, daher
 * jede VU eigene Mail).
 *
 * Thresholds (Hard-Fail):
 *   - http_req_duration p95 < 500ms
 *   - http_req_failed   < 0.5%
 *
 * Manuelle Ausfuehrung gegen Staging:
 *   k6 run -e BASE_URL=https://staging.werkzirkel.de tests/load/baseline.js
 *
 * Lokal:
 *   k6 run tests/load/baseline.js
 *
 * Ausgabe-JSON fuer Auswertung:
 *   k6 run --out json=baseline-result.json tests/load/baseline.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3210';

// Zaehlt zusaetzlich Fehlerquote pro Request-Gruppe.
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 }, // ramp-up
        { duration: '4m', target: 200 }, // plateau
        { duration: '30s', target: 0 }, // ramp-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // PRD §32 Performance-Budget + §38 Lasttest-Anforderung.
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.005'], // <0.5%
    errors: ['rate<0.005'],
  },
  // Kein Throw bei Errors — wir wollen die Quote messen, nicht abbrechen.
  noConnectionReuse: false,
  userAgent: 'k6-werkzirkel-baseline/1.0',
};

// Mix der GET-Routen, gewichtet wie reale Nutzung erwartet wird.
// 60% Startseite (LP-Traffic), 20% Werke-Liste, 15% Termine, 5% magic-link-POST.
function pickAction(rand) {
  if (rand < 0.6) return 'home';
  if (rand < 0.8) return 'werke';
  if (rand < 0.95) return 'termine';
  return 'magic';
}

export default function () {
  const action = pickAction(Math.random());

  let res;
  switch (action) {
    case 'home':
      res = http.get(`${BASE_URL}/`, { tags: { route: 'home' } });
      check(res, {
        'home: status 200': (r) => r.status === 200,
        'home: hat HTML': (r) =>
          typeof r.body === 'string' && r.body.includes('Werkzirkel'),
      }) || errorRate.add(1);
      break;

    case 'werke':
      res = http.get(`${BASE_URL}/werke`, { tags: { route: 'werke' } });
      check(res, {
        'werke: status <400': (r) => r.status < 400,
      }) || errorRate.add(1);
      break;

    case 'termine':
      res = http.get(`${BASE_URL}/termine`, { tags: { route: 'termine' } });
      check(res, {
        'termine: status <400': (r) => r.status < 400,
      }) || errorRate.add(1);
      break;

    case 'magic': {
      // Eigene Mail pro VU+Iter, damit Rate-Limit (5/h pro Mail) nicht greift.
      const email = `loadtest-${__VU}-${__ITER}-${Date.now()}@werkzirkel-test.local`;
      const payload = JSON.stringify({ email, zweck: 'login' });
      res = http.post(`${BASE_URL}/api/v1/auth/magic-link`, payload, {
        headers: {
          'Content-Type': 'application/json',
          // Origin matchen, sonst 403 (PRD §15.1 CSRF-Schutz).
          Origin: BASE_URL,
        },
        tags: { route: 'magic-link' },
      });
      // 204 = ok; 429 = IP-Rate-Limit (zaehlen wir nicht als Fehler — das ist
      // der Schutz, der greifen soll). Alles andere ist Bug.
      check(res, {
        'magic-link: 204 oder 429': (r) => r.status === 204 || r.status === 429,
      }) || errorRate.add(1);
      break;
    }
  }

  // Kurze Pause zwischen Iterationen — sonst ueberlasten 200 VUs ohne
  // realistisches Nutzer-Verhalten den Dev-Server.
  sleep(Math.random() * 0.5 + 0.5); // 0.5-1.0s
}

export function handleSummary(data) {
  // Knappes Console-Summary + JSON-Datei fuer CI-Auswertung.
  return {
    stdout: textSummary(data),
    'baseline-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const failRate = data.metrics.http_req_failed?.values?.rate ?? 0;
  const reqs = data.metrics.http_reqs?.values?.count ?? 0;
  const duration = data.state?.testRunDurationMs ?? 0;
  return [
    '',
    '=== Werkzirkel k6 Baseline ===',
    `Requests:        ${reqs}`,
    `Duration:        ${(duration / 1000).toFixed(1)}s`,
    `p95 latency:     ${p95.toFixed(1)} ms  (Budget: <500ms)`,
    `Failure rate:    ${(failRate * 100).toFixed(3)}%  (Budget: <0.5%)`,
    `Status:          ${p95 < 500 && failRate < 0.005 ? 'PASS' : 'FAIL'}`,
    '',
  ].join('\n');
}
