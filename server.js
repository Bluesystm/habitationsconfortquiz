const express = require('express');
const path = require('path');
const crypto = require('crypto');
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
// META CONVERSIONS API (CAPI) — Configuration
// ═══════════════════════════════════════════════════════════════
const META_PIXEL_ID = '1544867403647834';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || ''; // optionnel pour tester

// Middleware pour parser les requetes Twilio (form-encoded) et JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// IVR HABITATIONS CONFORT — Systeme telephonique automatise
// ═══════════════════════════════════════════════════════════════

const TWILIO_NUMBER = '+15817025497';

// == TRANSFERTS PAR DEPARTEMENT ==
const DEPARTEMENTS = {
  '1': {
    nom: 'Ventes',
    numero: '+14182652637',
    description: 'département des ventes'
  },
  '2': {
    nom: 'Installateurs',
    numero: '+14189305554',
    description: 'département des installateurs'
  },
  '3': {
    nom: 'Service clientèle',
    numero: '+15819958882',
    description: 'département du service à la clientèle'
  }
};

// == HEURES D'OUVERTURE ==
const HEURES = {
  ouverture: 10, // 10h
  fermeture: 17, // 17h
  jours: [1, 2, 3, 4, 5] // Lundi(1) a Vendredi(5)
};

// Verifier si on est dans les heures d'ouverture
function estOuvert() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hour12: false });
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short' });

  const heure = parseInt(formatter.format(now));
  const jour = dayFormatter.format(now);

  const jourMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const jourNum = jourMap[jour];

  const dansLesHeures = heure >= HEURES.ouverture && heure < HEURES.fermeture;
  const jourOuvrable = HEURES.jours.includes(jourNum);

  return dansLesHeures && jourOuvrable;
}

// -- APPEL ENTRANT : Menu IVR --
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();

  if (estOuvert()) {
    const gather = twiml.gather({
      numDigits: 1,
      action: '/menu-selection',
      method: 'POST',
      timeout: 8,
      language: 'fr-CA'
    });

    gather.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Bienvenue chez Habitations Confort. ' +
       'Pour le département des ventes, pour une demande de soumission ou toute question concernant votre soumission ou contrat, faites le 1. ' +
       'Pour le département des installateurs, pour toute question concernant vos travaux ou votre installation, faites le 2. ' +
       'Pour le département du service à la clientèle, pour les subventions, factures ou toute autre question, faites le 3.');

    twiml.redirect('/voice');

  } else {
    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Bienvenue chez Habitations Confort. ' +
       'Nos bureaux sont présentement fermés. ' +
       'Nos heures d\'ouverture sont du lundi au vendredi, de 10 heures à 17 heures. ' +
       'Veuillez laisser votre nom, numéro de téléphone et la raison de votre appel après le signal, ' +
       'et nous vous rappellerons dans les plus brefs délais. ' +
       'Merci de faire confiance à Habitations Confort.');

    twiml.record({
      maxLength: 120,
      action: '/enregistrement-complete',
      transcribe: false,
      playBeep: true,
      timeout: 5
    });

    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Aucun message reçu. Au revoir et merci d\'avoir appelé Habitations Confort.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// -- SELECTION DU MENU : Touche 1, 2 ou 3 --
app.post('/menu-selection', (req, res) => {
  const twiml = new VoiceResponse();
  const choix = req.body.Digits;
  const dept = DEPARTEMENTS[choix];

  if (dept) {
    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, `Transfert vers le ${dept.description}. Veuillez patienter.`);

    const dial = twiml.dial({
      action: '/pas-de-reponse',
      method: 'POST',
      timeout: 30,
      callerId: TWILIO_NUMBER
    });

    dial.number(dept.numero);

  } else {
    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Choix invalide.');

    twiml.redirect('/voice');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// -- PAS DE REPONSE : Messagerie vocale --
app.post('/pas-de-reponse', (req, res) => {
  const twiml = new VoiceResponse();
  const dialStatus = req.body.DialCallStatus;

  if (dialStatus === 'completed') {
    twiml.hangup();
  } else {
    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Désolé, personne n\'est disponible pour le moment. ' +
       'Veuillez laisser votre nom, numéro de téléphone et la raison de votre appel après le signal. ' +
       'Nous vous rappellerons dans les plus brefs délais.');

    twiml.record({
      maxLength: 120,
      action: '/enregistrement-complete',
      transcribe: false,
      playBeep: true,
      timeout: 5
    });

    twiml.say({
      voice: 'Google.fr-CA-Neural2-A',
      language: 'fr-CA'
    }, 'Aucun message reçu. Au revoir.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// -- ENREGISTREMENT COMPLETE --
app.post('/enregistrement-complete', (req, res) => {
  const twiml = new VoiceResponse();

  console.log('Nouveau message vocal recu:', {
    de: req.body.From,
    url: req.body.RecordingUrl,
    duree: req.body.RecordingDuration + ' secondes'
  });

  twiml.say({
    voice: 'Google.fr-CA-Neural2-A',
    language: 'fr-CA'
  }, 'Votre message a bien été enregistré. Nous vous rappellerons dans les plus brefs délais. ' +
     'Merci et bonne journée!');

  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// -- STATUS IVR --
app.get('/ivr-status', (req, res) => {
  const ouvert = estOuvert();
  res.json({
    status: 'ok',
    service: 'IVR Habitations Confort',
    bureaux: ouvert ? 'OUVERTS' : 'FERMES',
    departements: Object.keys(DEPARTEMENTS).map(k => ({
      touche: k,
      nom: DEPARTEMENTS[k].nom,
      numero: DEPARTEMENTS[k].numero
    }))
  });
});

// ═══════════════════════════════════════════════════════════════
// META CAPI — Endpoint serveur pour deduplication Pixel + CAPI
// ═══════════════════════════════════════════════════════════════

// Hash SHA-256 (lowercase, trim) — exigence Meta pour user_data
function hashSHA256(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase();
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

// Normaliser un numéro de téléphone canadien au format E.164 (+1XXXXXXXXXX)
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return '1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

app.post('/api/capi-lead', async (req, res) => {
  try {
    if (!META_ACCESS_TOKEN) {
      console.warn('[CAPI] META_ACCESS_TOKEN manquant — event ignoré');
      return res.status(200).json({ ok: false, reason: 'no_token' });
    }

    const {
      event_id,
      event_source_url,
      telephone,
      ville,
      fbp,
      fbc
    } = req.body;

    if (!event_id) {
      return res.status(400).json({ ok: false, reason: 'missing_event_id' });
    }

    // Données client
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';

    const userData = {
      ph: telephone ? [hashSHA256(normalizePhone(telephone))] : undefined,
      ct: ville ? [hashSHA256(ville)] : undefined,
      st: [hashSHA256('quebec')],
      country: [hashSHA256('ca')],
      client_ip_address: ip,
      client_user_agent: userAgent,
      fbp: fbp || undefined,
      fbc: fbc || undefined
    };

    // Nettoyer les undefined
    Object.keys(userData).forEach(k => userData[k] === undefined && delete userData[k]);

    const payload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: event_id,
        action_source: 'website',
        event_source_url: event_source_url || 'https://habitationsconfortquiz-production.up.railway.app',
        user_data: userData,
        custom_data: {
          content_name: 'Quiz Isolation Entretoit HC',
          content_category: 'isolation',
          currency: 'CAD',
          value: 0
        }
      }]
    };

    if (META_TEST_EVENT_CODE) {
      payload.test_event_code = META_TEST_EVENT_CODE;
    }

    const url = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[CAPI] Erreur Meta:', result);
      return res.status(200).json({ ok: false, error: result });
    }

    console.log('[CAPI] Lead envoyé OK — event_id:', event_id, 'received:', result.events_received);
    return res.status(200).json({ ok: true, events_received: result.events_received });

  } catch (err) {
    console.error('[CAPI] Exception:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ATTRIBUTION — IP client (le navigateur ne peut pas la connaitre)
// ═══════════════════════════════════════════════════════════════
app.get('/api/client-meta', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();
  res.json({ ip });
});

// ═══════════════════════════════════════════════════════════════
// ATTRIBUTION — relai vers le CRM
//
// Le navigateur poste ici (meme origine, pas de CORS). Ce serveur ajoute
// l'IP reelle du visiteur et relaie au CRM avec la cle partagee, qui ne
// quitte jamais le serveur.
//
// ADDITIF : n'affecte pas l'envoi vers Apps Script / Google Sheet, qui
// continue exactement comme avant. Si ce relai echoue, le lead arrive
// quand meme normalement dans le Sheet et le CRM.
// ═══════════════════════════════════════════════════════════════
const CRM_ATTRIBUTION_URL = process.env.CRM_ATTRIBUTION_URL
  || 'https://habitations-confort-crm-production.up.railway.app/api/attribution';

app.post('/api/attribution', async (req, res) => {
  const key = process.env.HC_ATTRIBUTION_KEY;
  if (!key) {
    console.warn('[Attribution] HC_ATTRIBUTION_KEY absente — relai desactive');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0].trim();

    const payload = {
      telephone:    req.body?.telephone    || '',
      ad_id:        req.body?.ad_id        || '',
      utm_source:   req.body?.utm_source   || '',
      utm_medium:   req.body?.utm_medium   || '',
      utm_content:  req.body?.utm_content  || '',
      utm_campaign: req.body?.utm_campaign || '',
      fbclid:       req.body?.fbclid       || '',
      fbp:          req.body?.fbp          || '',
      fbc:          req.body?.fbc          || '',
      client_ua:    req.headers['user-agent'] || '',
      client_ip:    ip,
    };

    const r = await fetch(CRM_ATTRIBUTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HC-Key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.warn('[Attribution] CRM a refuse — status', r.status);
    return res.status(200).json({ ok: r.ok, stored: !!j.stored });
  } catch (err) {
    // Jamais bloquant : le lead part vers le Sheet quoi qu'il arrive.
    console.warn('[Attribution] relai echoue:', err.message);
    return res.status(200).json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════════════
// QUIZ — Fichiers statiques
// ═══════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Habitations Confort — Quiz + IVR en ligne sur le port ${PORT}`);
});
