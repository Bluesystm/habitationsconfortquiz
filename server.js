const express = require('express');
const path = require('path');
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
const PORT = process.env.PORT || 3000;

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
// QUIZ — Fichiers statiques
// ═══════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Habitations Confort — Quiz + IVR en ligne sur le port ${PORT}`);
});
