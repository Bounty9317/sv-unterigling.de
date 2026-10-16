/**
 * Chronik der Schützengesellschaft Unterigling (1898–1998).
 * Texte unverändert von der bisherigen Seite übernommen. HTML ist nur für
 * Hervorhebungen (<strong>, <em>) enthalten und stammt ausschließlich aus dieser Datei.
 */
export type ChronikIcon =
  | 'landmark'
  | 'sprout'
  | 'swords'
  | 'target'
  | 'hammer'
  | 'beer'
  | 'party'
  | 'briefcase'
  | 'crown'
  | 'award';

export type ChronikBlock =
  | { typ: 'absatz'; html: string }
  | { typ: 'liste'; punkte: string[] }
  | { typ: 'hinweis'; html: string; gross?: boolean }
  | { typ: 'tabelle'; kopf: string[]; zeilen: string[][] };

export type ChronikAbschnitt = {
  nummer: number;
  titel: string;
  zeitraum: string;
  icon: ChronikIcon;
  bloecke: ChronikBlock[];
};

// ­ = weiche Trennstelle: auf schmalen Handys „Schützen-gesellschaft“ statt eines Umbruchs mitten im Wort
export const chronikTitel = 'Chronik der Schützen­gesellschaft Unterigling (1898–1998)';
export const chronikUntertitel = '100 Jahre Tradition, Gemeinschaft und Schießsport';

export const chronik: ChronikAbschnitt[] = [
  {
    nummer: 1,
    titel: 'Gründung und frühe Geschichte',
    zeitraum: '1898–1914',
    icon: 'landmark',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Die Schützen­gesellschaft Unterigling wurde im <strong>Herbst 1898</strong> gegründet. Zu den frühen Mitgliedern gehörten u. a.:',
      },
      {
        typ: 'liste',
        punkte: [
          'Benno Gerum',
          'Sylvester Schwarz',
          'Josef Mayer',
          'Richard Erdle (Schmiedemeister)',
          'Verwalter Soedler (Schloss Igling)',
        ],
      },
      {
        typ: 'absatz',
        html: 'Geschossen wurde im Gasthaus <strong>„Zum Weißen Lamm"</strong>, wo die Männer des Dorfes regelmäßige Schießabende und Preisschießen durchführten.',
      },
      {
        typ: 'hinweis',
        html: 'Der Erste Weltkrieg (1914–1918) brachte das Vereinsleben vollständig zum Erliegen.',
      },
    ],
  },
  {
    nummer: 2,
    titel: 'Wiederbeginn und Aufschwung',
    zeitraum: '1919–1939',
    icon: 'sprout',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Nach Kriegsende fanden sich die heimgekehrten Männer wieder im „Weißen Lamm" zusammen. Wertvolle Einblicke liefern die Schießbücher von 1928–1933, die zahlreiche Schützen aus Unterigling und den umliegenden Höfen nennen.',
      },
      { typ: 'absatz', html: 'Die 1930er Jahre waren geprägt durch:' },
      {
        typ: 'liste',
        punkte: [
          'gut besuchte Preisschießen',
          'Schützenball am rußigen Freitag',
          'steigende Mitgliederzahlen',
          'Kleinkaliberschießen am „Iglinger Keller"',
          'Feier des 40-jährigen Jubiläums 1938',
        ],
      },
      { typ: 'absatz', html: 'Der Verein war fest im Dorfleben verankert.' },
    ],
  },
  {
    nummer: 3,
    titel: 'Der Zweite Weltkrieg und Vereinsverbot',
    zeitraum: '1939–1950',
    icon: 'swords',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Mit Beginn des Zweiten Weltkriegs mussten viele Schützen zum Militär. Die letzten Schießen fanden mit Kriegsurlaubern statt.',
      },
      {
        typ: 'liste',
        punkte: [
          'Letztes dokumentiertes Schießen: <strong>20. März 1943</strong>',
          'Ab 1945: Vereinsverbot durch die amerikanische Militärregierung',
          'Die alte Schützenkette mit 8–9 Talern ging verloren',
          'Vereinsstutzen und viele Unterlagen wurden eingezogen oder vernichtet',
        ],
      },
      { typ: 'hinweis', html: 'Erst 1950 war eine Neugründung wieder erlaubt.' },
    ],
  },
  {
    nummer: 4,
    titel: 'Wiedergründung und Neubeginn',
    zeitraum: '1950–1961',
    icon: 'target',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Am <strong>2. September 1950</strong> erfolgte die offizielle Wiedergründung als „Sport- und Schützenverein Unterigling".',
      },
      { typ: 'absatz', html: '<strong>Vorstandschaft 1950:</strong>' },
      {
        typ: 'liste',
        punkte: [
          '1. Schützenmeister: Willi Braun',
          '2. Schützenmeister: Rasso Schorer',
          'Schriftführer/Kassier: Josef Lidl',
        ],
      },
      {
        typ: 'absatz',
        html: 'Der Schießbetrieb war anfangs improvisiert: Aus der Gaststube wurde durch ein Loch in der Wand in die Küche geschossen, der Kugelfang war ein Planenlappen neben dem Herd.',
      },
      {
        typ: 'absatz',
        html: 'Die Mitgliederzahlen entwickelten sich jedoch positiv (<strong>48 Mitglieder 1953</strong>).',
      },
    ],
  },
  {
    nummer: 5,
    titel: 'Ausbau & Modernisierung',
    zeitraum: '1961–1975',
    icon: 'hammer',
    bloecke: [
      { typ: 'absatz', html: '<strong>Wichtige Ereignisse:</strong>' },
      {
        typ: 'liste',
        punkte: [
          '1961: Erste Schützenkönigin – <strong>Anneliese Gossner</strong>',
          '1968: Neubau eines Schießstandes im ehemaligen Kuhstall',
          '1968: Erste große Vereinsfahrt',
          '1971: Großes Primizfest im Dorf',
          '1972: Offizielle Umbenennung in <strong>Schützen­gesellschaft Unterigling</strong>',
          '1973: 75-Jahr-Feier mit Jubiläumsscheibe',
        ],
      },
      {
        typ: 'absatz',
        html: 'Ende der 1970er-Jahre übergab Ludwig Maier sein sorgfältig geführtes Archiv an die nächste Generation.',
      },
    ],
  },
  {
    nummer: 6,
    titel: 'Eigenbetrieb & großes Vereinsleben',
    zeitraum: '1976–1988',
    icon: 'beer',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Ab 1976 durfte die Schützen­gesellschaft das Gasthaus „Zum Weißen Lamm" zeitweise selbst betreiben. Mitglieder renovierten das Schützenheim in Eigenleistung.',
      },
      { typ: 'absatz', html: '<strong>Wichtige Aktivitäten dieser Zeit:</strong>' },
      {
        typ: 'liste',
        punkte: [
          'Radsport­veranstaltungen',
          'Dolomitenfahrt 1977 (legendär in der Vereinsgeschichte)',
          'zahlreiche Grillfeste, Ausflüge & Faschingswägen',
          '1983: 85-jähriges Jubiläum mit Waldmesse',
          '1985: Fertigstellung der neuen Schießanlage im Obergeschoss',
          '1988: großes 90-jähriges Gründungsfest im Pfarrgarten',
        ],
      },
      { typ: 'absatz', html: 'Der Verein zählte zu dieser Zeit bereits <strong>über 90 Mitglieder</strong>.' },
    ],
  },
  {
    nummer: 7,
    titel: 'Veränderungen & Höhepunkte bis zur Jubiläumsfeier',
    zeitraum: '1988–1998',
    icon: 'party',
    bloecke: [
      { typ: 'absatz', html: 'Die späten 80er und 90er Jahre waren geprägt von:' },
      {
        typ: 'liste',
        punkte: [
          'kreativen Faschingswägen (z. B. „Blüms Gesundheitsreform", „Pflegeversicherung")',
          'geselligen Grillfesten am Geiselsberg',
          '„Iglinger Bauernballett" (legendärer Auftritt 1991 zum 60. Geburtstag von S. Schneider)',
          'Müllsammelaktionen („Saubere Umwelt")',
          'Vereinsfahrten nach Prag, Budapest, Berlin, Paris, Wien',
          'Umbau-, Reinigungs-, und Stützaktionen rund um das Schützenheim',
          'einer stabilen Mitgliederentwicklung',
        ],
      },
      { typ: 'hinweis', html: '1998 zählte der Verein <strong>128 Mitglieder</strong>.' },
    ],
  },
  {
    nummer: 8,
    titel: 'Schützenmeister',
    zeitraum: '1920–1998',
    icon: 'briefcase',
    bloecke: [
      {
        typ: 'tabelle',
        kopf: ['Zeitraum', 'Schützenmeister'],
        zeilen: [
          ['1920–1936', 'Sebastian Spreigl'],
          ['1937–1940', 'Sylvester Schneider'],
          ['1941', 'Johann Schneider sen.'],
          ['1942', 'Max Stier'],
          ['1943', 'Ludwig Maier sen.'],
          ['1944–1949', '<em>Vereinsverbot</em>'],
          ['1950', 'Willi Braun'],
          ['1951–1955', 'Ludwig Gossner'],
          ['1956–1959', 'Heinrich Spreigl'],
          ['1960–1963', 'Ludwig Gossner'],
          ['1964–1967', 'Otto Brugmoser'],
          ['1968–1975', 'Ludwig Maier'],
          ['1976–1979', 'Otto Brugmoser'],
          ['1980–1987', 'Hermann Häusler'],
          ['1988–1994', 'Hermann Wilbiller'],
          ['1995–1998', 'Georg Hutter'],
        ],
      },
    ],
  },
  {
    nummer: 9,
    titel: 'Schützenkönige & Schützen­königinnen',
    zeitraum: 'ab 1951',
    icon: 'crown',
    bloecke: [
      {
        typ: 'tabelle',
        kopf: ['Jahr', 'König/Königin'],
        zeilen: [
          ['1951', 'Alois Eberle'],
          ['1952', 'Josef Lidl jun.'],
          ['1953', 'Ludwig Gossner'],
          ['1954', 'Richard Erdle'],
          ['1955', 'Burkhard Morgenländer'],
          ['1956', 'Heinrich Spreigl'],
          ['1957', 'Johann Schneider'],
          ['1958', 'Johann Löcherer'],
          ['1959', 'Josef Brugmoser'],
          ['1960', 'Franz Sinnl'],
          ['1961', '<strong>Anneliese Gossner</strong>'],
          ['1962', 'Hermann Ried'],
          ['1963', 'Otto Brugmoser'],
          ['1964', 'Otto Schwarz'],
          ['1965', 'Ludwig Maier'],
          ['1966', 'Herbert Filser'],
          ['1967', 'Otto Brugmoser'],
          ['1968', 'Siegfried Wilbiller'],
          ['1969', 'Sylvester Schneider'],
          ['1970', 'Otto Brugmoser'],
          ['1971', 'Johann Rid'],
          ['1972', 'Karl Dodl'],
          ['1973', 'Herbert Filser'],
          ['1974', 'Ludwig Maier'],
          ['1975', 'Gerd Schneider'],
          ['1976', 'Anna Brugmoser'],
          ['1977', 'Anna Rupp'],
          ['1978', 'Josef Rid'],
          ['1979', 'Franz Zink jun.'],
          ['1980', 'Georg Schwarz'],
          ['1981', 'Sylvester Schneider'],
          ['1982', 'Heinrich Spreigl'],
          ['1983', 'Annemarie Wilbiller'],
          ['1984', 'Susanne Hutter'],
          ['1985', 'Otto Rössle'],
          ['1986', 'Susanne Hutter & Reinhard Rupp'],
          ['1987', 'Hans-Jürgen Schneider'],
          ['1989', 'Wolfgang Hausner'],
          ['1990', 'Ernst Höfler'],
          ['1991', 'Heinz Häusler'],
          ['1992', 'Herbert Filser'],
          ['1993', 'Georg Schwarz'],
          ['1994', 'Roland Hollmann'],
          ['1995', 'Hermann Wilbiller'],
          ['1996', 'Albert Schorer'],
          ['1997', 'Johann Trommer'],
          ['1998', 'Günter Reimers'],
        ],
      },
    ],
  },
  {
    nummer: 10,
    titel: 'Fazit zum Jubiläumsjahr 1998',
    zeitraum: '1998',
    icon: 'award',
    bloecke: [
      {
        typ: 'absatz',
        html: 'Im Jahr 1998, dem 100-jährigen Jubiläum, blickt die Schützen­gesellschaft Unterigling auf eine bewegte und lebendige Vereinsgeschichte zurück:',
      },
      {
        typ: 'liste',
        punkte: [
          'gewachsene Tradition',
          'starkes Zusammengehörigkeits­gefühl',
          'engagierte Ehrenamtliche',
          'unzählige schöne Erinnerungen aus Festen, Fahrten und Fasching',
          'moderner Schießsport auf solider Basis',
        ],
      },
      {
        typ: 'hinweis',
        gross: true,
        html: '<strong>Die Schützen­gesellschaft Unterigling verbindet bis heute Gemeinschaft, Heimatgefühl und sportlichen Ehrgeiz.</strong>',
      },
    ],
  },
];
