/**
 * Zentrale Vereinsdaten. Alles, was an mehreren Stellen der Seite steht
 * (Kopf, Fuß, Kontakt, Impressum, Anmeldedialog, strukturierte Daten), kommt von hier.
 */
export const verein = {
  name: 'Schützenverein Unterigling e.V.',
  kurzname: 'Schützenverein Unterigling',
  gegruendet: 1898,
  slogan: 'Tradition trifft Präzision – Seit Generationen vereint durch Leidenschaft für den Schießsport',
  adresse: {
    strasse: 'Unteriglinger Str. 56',
    plz: '86859',
    ort: 'Igling',
  },
  email: 'schuetzenvereinunterigling@gmail.com',
  whatsappKanal: 'https://whatsapp.com/channel/0029Vb0dG73JENy7YI5ce10p',
  googleMapsLink: 'https://maps.app.goo.gl/r9spVRRwZTgc8Pbq5',
  googleMapsEmbed:
    'https://www.google.com/maps?q=Unteriglinger+Str.+56,+86859+Igling&z=16&output=embed',
  vorstand: [
    { funktion: '1. Vorsitzender', name: 'Moritz Schneider' },
    { funktion: '2. Vorsitzender', name: 'Theresa Zink' },
  ],
  vereinsregister: {
    gericht: 'Amtsgericht Augsburg',
    nummer: 'VR 40757',
  },
  mitgliedsbeitrag: '15 €',
  mitgliedsantrag: '/downloads/beitrittserklaerung-sepa-mandat.pdf',
} as const;

/** Öffnungszeiten – identisch auf Startseite, Veranstaltungen, Sport, Kontakt und im Anmeldedialog. */
export const oeffnungszeiten = {
  samstag: {
    titel: 'Samstag',
    zeitraum: 'Oktober bis März',
    zeiten: 'Ab 19:30 - 23:00/24:00 Uhr',
    hinweis: 'Schießstand: 19:30 - 21:00 Uhr',
  },
  sonntag: {
    titel: 'Sonntag',
    bezeichnung: 'Frühschoppen',
    zeiten: '10:00 - 12:00 Uhr',
    hinweis: 'An Sonn- und Feiertagen',
  },
  schiessstand: {
    zeiten: '19:30 Uhr - 21:00 Uhr',
    tag: 'Samstag',
    tagZeiten: '19:30 - 21:00 Uhr',
    zeitraum: 'Ende Oktober bis Ende März',
  },
  weitere: 'Weitere Öffnungszeiten bei Veranstaltungen',
} as const;

export const adresseEinzeilig = `${verein.adresse.strasse}, ${verein.adresse.plz} ${verein.adresse.ort}`;

export type NavItem = { href: string; label: string };

export const hauptnavigation: NavItem[] = [
  { href: '/', label: 'Startseite' },
  { href: '/ueber-uns', label: 'Über uns' },
  { href: '/chronik', label: 'Chronik' },
  { href: '/veranstaltungen', label: 'Veranstaltungen' },
  { href: '/galerie', label: 'Galerie' },
  { href: '/sport', label: 'Sport' },
  { href: '/mitgliedschaft', label: 'Mitgliedschaft' },
  { href: '/kontakt', label: 'Kontakt' },
];
