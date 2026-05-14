/**
 * Stripe-Client-Wrapper.
 *
 * - `getStripe()` liefert eine Singleton-Stripe-Instanz; wirft, wenn
 *   `STRIPE_SECRET_KEY` fehlt. Endpunkte sollten zuerst
 *   `isStripeConfigured()` pruefen und sonst den Dev-Fallback ausfuehren.
 * - `isStripeConfigured()` true, wenn `STRIPE_SECRET_KEY` einen nicht-leeren
 *   Wert hat. Damit kann Werkzirkel in der Dev-Umgebung ohne Stripe-Konto
 *   sauber laufen — Geldbeitrag-Endpoint gibt dann 422 mit einem klaren
 *   Hinweis statt zu crashen.
 *
 * Apikey-Version wird hier zentral gepinnt — Aenderungen am API-Vertrag
 * gehen ueber dieses File.
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY ist nicht konfiguriert.');
    }
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return _stripe;
}

/**
 * Pruest, ob STRIPE_SECRET_KEY plausibel gesetzt ist — heuristisch: ein
 * echter Stripe-Secret-Key hat die Form `sk_test_<token>` oder
 * `sk_live_<token>` und ist deutlich laenger als 16 Zeichen. Reine
 * Praefixe wie `sk_test_` ohne Token (die wir in `.env.example` setzen)
 * werden als „nicht konfiguriert" behandelt, damit der Dev-Fallback-Pfad
 * trotzdem greift.
 */
export function isStripeConfigured(): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return false;
  // Reine Praefixe oder zu kurze Werte → nicht konfiguriert.
  if (key.length < 16) return false;
  return true;
}

/**
 * Testzweck: Reset des Singletons. Wird in Vitest verwendet, falls Stripe
 * jemals direkt gemockt werden muss. Im Normalbetrieb nie aufrufen.
 */
export function _resetStripeForTests(): void {
  _stripe = null;
}
