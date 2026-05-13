CREATE TABLE "stadt" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"kurator_id" text,
	"beschreibung" text,
	"sortierung" integer DEFAULT 100 NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stadt_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "magic_link_token" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"zweck" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verwendet_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutzer" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verifiziert_am" timestamp with time zone,
	"klarname" text NOT NULL,
	"anzeigename" text NOT NULL,
	"stadt_id" text NOT NULL,
	"kurzbeschreibung" text,
	"faehigkeiten" text[] DEFAULT '{}'::text[] NOT NULL,
	"interessen" text[] DEFAULT '{}'::text[] NOT NULL,
	"rollen" text[] DEFAULT '{macher}'::text[] NOT NULL,
	"website" text,
	"github" text,
	"linkedin" text,
	"mastodon" text,
	"avatar_url" text,
	"teilnahmeart" text,
	"foerdermitglied_seit" timestamp with time zone,
	"foerdermitglied_bis" timestamp with time zone,
	"benachrichtigungs_einstellungen" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'aktiv' NOT NULL,
	"loeschung_anstehend_bis" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_adresse" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "werk" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"name" text NOT NULL,
	"kurzbeschreibung" text NOT NULL,
	"problem" text NOT NULL,
	"zielgruppe" text NOT NULL,
	"werkstand" text NOT NULL,
	"hilfebedarf" text[] DEFAULT '{}'::text[] NOT NULL,
	"link" text,
	"screenshots" text[] DEFAULT '{}'::text[] NOT NULL,
	"sichtbarkeit" text DEFAULT 'oeffentlich' NOT NULL,
	"status" text DEFAULT 'aktiv' NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "werk_historie" (
	"id" text PRIMARY KEY NOT NULL,
	"werk_id" text NOT NULL,
	"werkstand_alt" text,
	"werkstand_neu" text,
	"geaendert_von" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"pruefrunde_id" text NOT NULL,
	"tester_id" text,
	"erster_eindruck" text,
	"verstaendlichkeit" text,
	"nutzen" text,
	"bedienbarkeit" text,
	"fehler" text,
	"positionierung" text,
	"zahlungsbereitschaft" text,
	"verbesserungen" text,
	"gesamteindruck" text NOT NULL,
	"hilfreich_markiert" boolean DEFAULT false NOT NULL,
	"hilfreich_markiert_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pruefrunde" (
	"id" text PRIMARY KEY NOT NULL,
	"werk_id" text NOT NULL,
	"titel" text NOT NULL,
	"testziel" text NOT NULL,
	"testaufgabe" text NOT NULL,
	"zielgruppe" text NOT NULL,
	"zeitbedarf_minuten" integer NOT NULL,
	"gesuchte_tester" integer NOT NULL,
	"feedback_kategorien" text[] NOT NULL,
	"frist" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'entwurf' NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pruefrunden_anmeldung" (
	"id" text PRIMARY KEY NOT NULL,
	"pruefrunde_id" text NOT NULL,
	"tester_id" text NOT NULL,
	"status" text DEFAULT 'angemeldet' NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pruefrunden_verpflichtung" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"aus_pruefrunde_id" text NOT NULL,
	"frist" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'offen' NOT NULL,
	"erfuellt_durch_feedback_id" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_saldo" (
	"nutzer_id" text PRIMARY KEY NOT NULL,
	"tests_gegeben" integer DEFAULT 0 NOT NULL,
	"tests_erhalten" integer DEFAULT 0 NOT NULL,
	"offene_verpflichtung_anzahl" integer DEFAULT 0 NOT NULL,
	"naechste_verpflichtung_frist" timestamp with time zone,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "werkstattbeitrag" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"art" text NOT NULL,
	"hoehe_euro_cent" integer,
	"nachweis_text" text,
	"nachweis_dokument_url" text,
	"termin_id" text,
	"stripe_session_id" text,
	"status" text DEFAULT 'erfasst' NOT NULL,
	"verifiziert_durch" text,
	"verifiziert_am" timestamp with time zone,
	"gueltig_bis" timestamp with time zone,
	"verwendet_fuer_bedarfe" integer DEFAULT 0 NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bedarf" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"organisation" text NOT NULL,
	"titel" text NOT NULL,
	"problem" text NOT NULL,
	"nutzen" text NOT NULL,
	"stadt_id" text NOT NULL,
	"groessenordnung_zeit_wochen" integer,
	"groessenordnung_aufwand_tage" integer,
	"geldrahmen_min_euro_cent" integer,
	"geldrahmen_max_euro_cent" integer,
	"frist" timestamp with time zone NOT NULL,
	"werkstattbeitrag_id" text,
	"branche" text,
	"bevorzugter_werkstand" text,
	"status" text DEFAULT 'entwurf' NOT NULL,
	"erfuellt_von_werk_id" text,
	"selbstauskunft_groesse_euro_cent_min" integer,
	"selbstauskunft_groesse_euro_cent_max" integer,
	"erfuellt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "werkangebot" (
	"id" text PRIMARY KEY NOT NULL,
	"bedarf_id" text NOT NULL,
	"werk_id" text NOT NULL,
	"macher_id" text NOT NULL,
	"konkretes_vorgehen" text NOT NULL,
	"ausdruecklicher_ausschluss" text NOT NULL,
	"erster_liefer_meilenstein" text NOT NULL,
	"status" text DEFAULT 'eingereicht' NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foerderprofil" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"organisation" text NOT NULL,
	"foerderart" text NOT NULL,
	"foerderrahmen_jahr_min_euro_cent" integer,
	"foerderrahmen_jahr_max_euro_cent" integer,
	"foerderrahmen_einzel_max_euro_cent" integer,
	"bevorzugte_werke" text,
	"gegenleistung_typ" text NOT NULL,
	"gegenleistung_text" text,
	"verifikation_status" text DEFAULT 'entwurf' NOT NULL,
	"verifizierer_id" text,
	"verifiziert_am" timestamp with time zone,
	"pausiert_seit" timestamp with time zone,
	"letzte_bedarfsschau_id" text,
	"letzte_bedarfsschau_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foerderprofil_nutzer_id_unique" UNIQUE("nutzer_id")
);
--> statement-breakpoint
CREATE TABLE "termin" (
	"id" text PRIMARY KEY NOT NULL,
	"stadt_id" text NOT NULL,
	"typ" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text NOT NULL,
	"ort_text" text,
	"online_link" text,
	"datum_uhrzeit" timestamp with time zone NOT NULL,
	"max_teilnehmer" integer NOT NULL,
	"erstellt_von" text NOT NULL,
	"status" text DEFAULT 'geplant' NOT NULL,
	"notizen_nach_termin" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "termin_anmeldung" (
	"id" text PRIMARY KEY NOT NULL,
	"termin_id" text NOT NULL,
	"nutzer_id" text NOT NULL,
	"status" text DEFAULT 'angemeldet' NOT NULL,
	"notiz" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "termin_bedarf_bezug" (
	"id" text PRIMARY KEY NOT NULL,
	"termin_id" text NOT NULL,
	"bedarf_id" text NOT NULL,
	"reihenfolge" integer DEFAULT 100 NOT NULL,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "termin_foerderprofil_bezug" (
	"id" text PRIMARY KEY NOT NULL,
	"termin_id" text NOT NULL,
	"foerderprofil_id" text NOT NULL,
	"reihenfolge" integer DEFAULT 100 NOT NULL,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "termin_werk_bezug" (
	"id" text PRIMARY KEY NOT NULL,
	"termin_id" text NOT NULL,
	"werk_id" text NOT NULL,
	"reihenfolge" integer DEFAULT 100 NOT NULL,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "hilfegesuch" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"werk_id" text,
	"stadt_id" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"gueltig_bis" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'offen' NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hilfegesuch_antwort" (
	"id" text PRIMARY KEY NOT NULL,
	"hilfegesuch_id" text NOT NULL,
	"nutzer_id" text NOT NULL,
	"text" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erfolgsbeitrag" (
	"id" text PRIMARY KEY NOT NULL,
	"bedarf_id" text,
	"zahler_nutzer_id" text,
	"hoehe_euro_cent" integer NOT NULL,
	"prozent_satz" numeric(5, 2),
	"stripe_session_id" text NOT NULL,
	"status" text DEFAULT 'initiiert' NOT NULL,
	"gezahlt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "werkstatt_kasse_eintrag" (
	"id" text PRIMARY KEY NOT NULL,
	"stadt_id" text NOT NULL,
	"typ" text NOT NULL,
	"kategorie" text NOT NULL,
	"hoehe_euro_cent" integer NOT NULL,
	"beschreibung" text NOT NULL,
	"beleg_url" text,
	"referenz_typ" text,
	"referenz_id" text,
	"datum" date NOT NULL,
	"quartal" text NOT NULL,
	"erfasst_durch" text NOT NULL,
	"freigegeben_durch" text,
	"freigegeben_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foerdermitgliedschaft" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text NOT NULL,
	"stufe" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"beginn" timestamp with time zone NOT NULL,
	"ende" timestamp with time zone,
	"status" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foerdermitgliedschaft_nutzer_id_unique" UNIQUE("nutzer_id")
);
--> statement-breakpoint
CREATE TABLE "meldung" (
	"id" text PRIMARY KEY NOT NULL,
	"gemeldet_von" text,
	"referenz_typ" text NOT NULL,
	"referenz_id" text NOT NULL,
	"kategorie" text NOT NULL,
	"beschreibung" text,
	"status" text DEFAULT 'offen' NOT NULL,
	"bearbeiter_id" text,
	"ergebnis_notiz" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"geschlossen_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text,
	"aktion" text NOT NULL,
	"referenz_typ" text,
	"referenz_id" text,
	"metadaten" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_adresse" text,
	"user_agent" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_benachrichtigung_log" (
	"id" text PRIMARY KEY NOT NULL,
	"nutzer_id" text,
	"email" text NOT NULL,
	"template" text NOT NULL,
	"betreff" text NOT NULL,
	"status" text NOT NULL,
	"resend_id" text,
	"fehler_meldung" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nutzer" ADD CONSTRAINT "nutzer_stadt_id_stadt_id_fk" FOREIGN KEY ("stadt_id") REFERENCES "public"."stadt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werk" ADD CONSTRAINT "werk_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werk_historie" ADD CONSTRAINT "werk_historie_werk_id_werk_id_fk" FOREIGN KEY ("werk_id") REFERENCES "public"."werk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werk_historie" ADD CONSTRAINT "werk_historie_geaendert_von_nutzer_id_fk" FOREIGN KEY ("geaendert_von") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_pruefrunde_id_pruefrunde_id_fk" FOREIGN KEY ("pruefrunde_id") REFERENCES "public"."pruefrunde"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tester_id_nutzer_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunde" ADD CONSTRAINT "pruefrunde_werk_id_werk_id_fk" FOREIGN KEY ("werk_id") REFERENCES "public"."werk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunden_anmeldung" ADD CONSTRAINT "pruefrunden_anmeldung_pruefrunde_id_pruefrunde_id_fk" FOREIGN KEY ("pruefrunde_id") REFERENCES "public"."pruefrunde"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunden_anmeldung" ADD CONSTRAINT "pruefrunden_anmeldung_tester_id_nutzer_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunden_verpflichtung" ADD CONSTRAINT "pruefrunden_verpflichtung_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunden_verpflichtung" ADD CONSTRAINT "pruefrunden_verpflichtung_aus_pruefrunde_id_pruefrunde_id_fk" FOREIGN KEY ("aus_pruefrunde_id") REFERENCES "public"."pruefrunde"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pruefrunden_verpflichtung" ADD CONSTRAINT "pruefrunden_verpflichtung_erfuellt_durch_feedback_id_feedback_id_fk" FOREIGN KEY ("erfuellt_durch_feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_saldo" ADD CONSTRAINT "test_saldo_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkstattbeitrag" ADD CONSTRAINT "werkstattbeitrag_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkstattbeitrag" ADD CONSTRAINT "werkstattbeitrag_verifiziert_durch_nutzer_id_fk" FOREIGN KEY ("verifiziert_durch") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bedarf" ADD CONSTRAINT "bedarf_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bedarf" ADD CONSTRAINT "bedarf_stadt_id_stadt_id_fk" FOREIGN KEY ("stadt_id") REFERENCES "public"."stadt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bedarf" ADD CONSTRAINT "bedarf_werkstattbeitrag_id_werkstattbeitrag_id_fk" FOREIGN KEY ("werkstattbeitrag_id") REFERENCES "public"."werkstattbeitrag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bedarf" ADD CONSTRAINT "bedarf_erfuellt_von_werk_id_werk_id_fk" FOREIGN KEY ("erfuellt_von_werk_id") REFERENCES "public"."werk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkangebot" ADD CONSTRAINT "werkangebot_bedarf_id_bedarf_id_fk" FOREIGN KEY ("bedarf_id") REFERENCES "public"."bedarf"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkangebot" ADD CONSTRAINT "werkangebot_werk_id_werk_id_fk" FOREIGN KEY ("werk_id") REFERENCES "public"."werk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkangebot" ADD CONSTRAINT "werkangebot_macher_id_nutzer_id_fk" FOREIGN KEY ("macher_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foerderprofil" ADD CONSTRAINT "foerderprofil_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foerderprofil" ADD CONSTRAINT "foerderprofil_verifizierer_id_nutzer_id_fk" FOREIGN KEY ("verifizierer_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin" ADD CONSTRAINT "termin_stadt_id_stadt_id_fk" FOREIGN KEY ("stadt_id") REFERENCES "public"."stadt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin" ADD CONSTRAINT "termin_erstellt_von_nutzer_id_fk" FOREIGN KEY ("erstellt_von") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_anmeldung" ADD CONSTRAINT "termin_anmeldung_termin_id_termin_id_fk" FOREIGN KEY ("termin_id") REFERENCES "public"."termin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_anmeldung" ADD CONSTRAINT "termin_anmeldung_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_bedarf_bezug" ADD CONSTRAINT "termin_bedarf_bezug_termin_id_termin_id_fk" FOREIGN KEY ("termin_id") REFERENCES "public"."termin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_bedarf_bezug" ADD CONSTRAINT "termin_bedarf_bezug_bedarf_id_bedarf_id_fk" FOREIGN KEY ("bedarf_id") REFERENCES "public"."bedarf"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_foerderprofil_bezug" ADD CONSTRAINT "termin_foerderprofil_bezug_termin_id_termin_id_fk" FOREIGN KEY ("termin_id") REFERENCES "public"."termin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_foerderprofil_bezug" ADD CONSTRAINT "termin_foerderprofil_bezug_foerderprofil_id_foerderprofil_id_fk" FOREIGN KEY ("foerderprofil_id") REFERENCES "public"."foerderprofil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_werk_bezug" ADD CONSTRAINT "termin_werk_bezug_termin_id_termin_id_fk" FOREIGN KEY ("termin_id") REFERENCES "public"."termin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termin_werk_bezug" ADD CONSTRAINT "termin_werk_bezug_werk_id_werk_id_fk" FOREIGN KEY ("werk_id") REFERENCES "public"."werk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilfegesuch" ADD CONSTRAINT "hilfegesuch_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilfegesuch" ADD CONSTRAINT "hilfegesuch_werk_id_werk_id_fk" FOREIGN KEY ("werk_id") REFERENCES "public"."werk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilfegesuch" ADD CONSTRAINT "hilfegesuch_stadt_id_stadt_id_fk" FOREIGN KEY ("stadt_id") REFERENCES "public"."stadt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilfegesuch_antwort" ADD CONSTRAINT "hilfegesuch_antwort_hilfegesuch_id_hilfegesuch_id_fk" FOREIGN KEY ("hilfegesuch_id") REFERENCES "public"."hilfegesuch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilfegesuch_antwort" ADD CONSTRAINT "hilfegesuch_antwort_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erfolgsbeitrag" ADD CONSTRAINT "erfolgsbeitrag_bedarf_id_bedarf_id_fk" FOREIGN KEY ("bedarf_id") REFERENCES "public"."bedarf"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erfolgsbeitrag" ADD CONSTRAINT "erfolgsbeitrag_zahler_nutzer_id_nutzer_id_fk" FOREIGN KEY ("zahler_nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkstatt_kasse_eintrag" ADD CONSTRAINT "werkstatt_kasse_eintrag_stadt_id_stadt_id_fk" FOREIGN KEY ("stadt_id") REFERENCES "public"."stadt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkstatt_kasse_eintrag" ADD CONSTRAINT "werkstatt_kasse_eintrag_erfasst_durch_nutzer_id_fk" FOREIGN KEY ("erfasst_durch") REFERENCES "public"."nutzer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "werkstatt_kasse_eintrag" ADD CONSTRAINT "werkstatt_kasse_eintrag_freigegeben_durch_nutzer_id_fk" FOREIGN KEY ("freigegeben_durch") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foerdermitgliedschaft" ADD CONSTRAINT "foerdermitgliedschaft_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldung" ADD CONSTRAINT "meldung_gemeldet_von_nutzer_id_fk" FOREIGN KEY ("gemeldet_von") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meldung" ADD CONSTRAINT "meldung_bearbeiter_id_nutzer_id_fk" FOREIGN KEY ("bearbeiter_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_benachrichtigung_log" ADD CONSTRAINT "email_benachrichtigung_log_nutzer_id_nutzer_id_fk" FOREIGN KEY ("nutzer_id") REFERENCES "public"."nutzer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stadt_status_idx" ON "stadt" USING btree ("status");--> statement-breakpoint
CREATE INDEX "magic_link_email_idx" ON "magic_link_token" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_token_idx" ON "magic_link_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_link_expires_at_idx" ON "magic_link_token" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nutzer_email_idx" ON "nutzer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "nutzer_stadt_id_idx" ON "nutzer" USING btree ("stadt_id");--> statement-breakpoint
CREATE INDEX "nutzer_status_idx" ON "nutzer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_nutzer_id_idx" ON "session" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "werk_nutzer_id_idx" ON "werk" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "werk_werkstand_idx" ON "werk" USING btree ("werkstand");--> statement-breakpoint
CREATE INDEX "werk_sichtbarkeit_status_idx" ON "werk" USING btree ("sichtbarkeit","status");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_uniq" ON "feedback" USING btree ("pruefrunde_id","tester_id");--> statement-breakpoint
CREATE INDEX "feedback_pruefrunde_id_idx" ON "feedback" USING btree ("pruefrunde_id");--> statement-breakpoint
CREATE INDEX "feedback_tester_id_idx" ON "feedback" USING btree ("tester_id");--> statement-breakpoint
CREATE INDEX "pruefrunde_werk_id_idx" ON "pruefrunde" USING btree ("werk_id");--> statement-breakpoint
CREATE INDEX "pruefrunde_status_frist_idx" ON "pruefrunde" USING btree ("status","frist");--> statement-breakpoint
CREATE UNIQUE INDEX "pruefrunden_anmeldung_uniq" ON "pruefrunden_anmeldung" USING btree ("pruefrunde_id","tester_id");--> statement-breakpoint
CREATE INDEX "werkstattbeitrag_nutzer_id_idx" ON "werkstattbeitrag" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "werkstattbeitrag_status_idx" ON "werkstattbeitrag" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bedarf_nutzer_id_idx" ON "bedarf" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "bedarf_stadt_status_idx" ON "bedarf" USING btree ("stadt_id","status");--> statement-breakpoint
CREATE INDEX "bedarf_frist_idx" ON "bedarf" USING btree ("frist");--> statement-breakpoint
CREATE UNIQUE INDEX "werkangebot_bedarf_werk_uniq" ON "werkangebot" USING btree ("bedarf_id","werk_id");--> statement-breakpoint
CREATE INDEX "werkangebot_bedarf_id_idx" ON "werkangebot" USING btree ("bedarf_id");--> statement-breakpoint
CREATE INDEX "werkangebot_macher_id_idx" ON "werkangebot" USING btree ("macher_id");--> statement-breakpoint
CREATE INDEX "foerderprofil_status_idx" ON "foerderprofil" USING btree ("verifikation_status");--> statement-breakpoint
CREATE INDEX "foerderprofil_letzte_bedarfsschau_idx" ON "foerderprofil" USING btree ("letzte_bedarfsschau_am");--> statement-breakpoint
CREATE INDEX "termin_stadt_typ_idx" ON "termin" USING btree ("stadt_id","typ");--> statement-breakpoint
CREATE INDEX "termin_datum_idx" ON "termin" USING btree ("datum_uhrzeit");--> statement-breakpoint
CREATE INDEX "termin_status_idx" ON "termin" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "termin_anmeldung_uniq" ON "termin_anmeldung" USING btree ("termin_id","nutzer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "termin_bedarf_bezug_uniq" ON "termin_bedarf_bezug" USING btree ("termin_id","bedarf_id");--> statement-breakpoint
CREATE UNIQUE INDEX "termin_foerderprofil_bezug_uniq" ON "termin_foerderprofil_bezug" USING btree ("termin_id","foerderprofil_id");--> statement-breakpoint
CREATE UNIQUE INDEX "termin_werk_bezug_uniq" ON "termin_werk_bezug" USING btree ("termin_id","werk_id");--> statement-breakpoint
CREATE INDEX "hilfegesuch_antwort_hilfegesuch_id_idx" ON "hilfegesuch_antwort" USING btree ("hilfegesuch_id");--> statement-breakpoint
CREATE INDEX "meldung_status_idx" ON "meldung" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meldung_referenz_idx" ON "meldung" USING btree ("referenz_typ","referenz_id");--> statement-breakpoint
CREATE INDEX "audit_log_nutzer_id_idx" ON "audit_log" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "audit_log_aktion_idx" ON "audit_log" USING btree ("aktion");--> statement-breakpoint
CREATE INDEX "audit_log_erstellt_am_idx" ON "audit_log" USING btree ("erstellt_am");--> statement-breakpoint
CREATE INDEX "email_log_nutzer_id_idx" ON "email_benachrichtigung_log" USING btree ("nutzer_id");--> statement-breakpoint
CREATE INDEX "email_log_erstellt_am_idx" ON "email_benachrichtigung_log" USING btree ("erstellt_am");