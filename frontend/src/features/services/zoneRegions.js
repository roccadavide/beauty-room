/**
 * zoneRegions.js
 *
 * Le opzioni dal backend NON hanno dati sulle regioni del corpo, quindi la
 * mappa zona→regioni vive qui (frontend). Vale sia per Epilazione laser che
 * per Epilazione a cera: i nomi puntano alle stesse regioni della silhouette.
 *
 * I nomi vengono normalizzati (minuscolo, spazi compattati, suffisso
 * "— Donna/Uomo" rimosso) così "Gamba Intera — Donna" e "Gamba Intera — Uomo"
 * mappano entrambi sulle gambe. Le zone non mappate ritornano [] (la silhouette
 * semplicemente non accende nulla, senza rompere).
 *
 * Region ids disponibili sulla silhouette (vedi BodyMap.jsx):
 *   FRONTE: sopracciglia, baffetto, mento, collo, spalle, ascella-l, ascella-r,
 *           petto, addome, linea-alba, braccio-l, braccio-r, inguine,
 *           coscia-l, coscia-r, polpaccio-l, polpaccio-r
 *   RETRO:  spalle, braccio-l, braccio-r, schiena-alta, lombare, glutei,
 *           coscia-l, coscia-r, polpaccio-l, polpaccio-r
 * (braccia/gambe/spalle hanno lo stesso id su fronte e retro → si accendono su entrambi)
 */

const ZONE_REGIONS = {
  // viso / testa
  baffetti: ["baffetto"],
  "baffetti / mento / basette": ["baffetto", "mento"],
  mento: ["mento"],
  "mento + baffetti": ["mento", "baffetto"],
  sopracciglia: ["sopracciglia"],
  "viso completo": ["sopracciglia", "baffetto", "mento"],

  // busto fronte
  seno: ["petto"],
  petto: ["petto"],
  "petto piccolo": ["petto"],
  "petto completo": ["petto"],
  addome: ["addome"],
  "linea alba": ["linea-alba"],
  "petto + addome": ["petto", "addome"],
  "addome + inguine totale": ["addome", "inguine"],

  // busto retro
  spalle: ["spalle"],
  "zona lombare": ["lombare"],
  schiena: ["schiena-alta", "lombare"],
  "schiena completa": ["schiena-alta", "lombare"],

  // braccia (fronte + retro)
  braccia: ["braccio-l", "braccio-r"],
  "braccia / avambraccia": ["braccio-l", "braccio-r"],

  // ascelle
  ascelle: ["ascella-l", "ascella-r"],

  // inguine
  "inguine parziale": ["inguine"],
  "inguine totale": ["inguine"],

  // glutei (retro)
  glutei: ["glutei"],

  // gambe (fronte + retro)
  "mezza gamba": ["polpaccio-l", "polpaccio-r"],
  "gamba intera": ["coscia-l", "coscia-r", "polpaccio-l", "polpaccio-r"],
  "gamba intera + glutei": ["coscia-l", "coscia-r", "polpaccio-l", "polpaccio-r", "glutei"],
};

export function normalizeZoneName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\s*[—–-]\s*(donna|uomo)\s*$/, "") // toglie "— Donna" / "- Uomo"
    .replace(/\s+/g, " ")
    .trim();
}

/** Ritorna gli id delle regioni per un nome opzione. [] se non mappato. */
export function resolveZoneRegions(name) {
  const key = normalizeZoneName(name);
  const regions = ZONE_REGIONS[key];
  if (!regions && import.meta?.env?.DEV && name) {
    // aiuta a scoprire nomi non mappati (es. se Michela rinomina una zona)
    console.warn(`[zoneRegions] nessuna mappatura per "${name}" (norm: "${key}")`);
  }
  return regions || [];
}

/** Comodo: regioni uniche per una lista di opzioni. */
export function regionsForOptions(options = []) {
  const set = new Set();
  options.forEach(o => resolveZoneRegions(o?.name).forEach(r => set.add(r)));
  return [...set];
}

export default ZONE_REGIONS;
