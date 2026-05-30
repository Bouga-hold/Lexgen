const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const CSS = `
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.8; color: #1a2e1a; max-width: 700px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #1a2e1a; padding-bottom: 16px; margin-bottom: 8px; }
  .subtitle { text-align: center; font-size: 11px; color: #5a6b5a; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 32px; }
  .parties { background: #f0f4ee; border-left: 3px solid #2d5a27; padding: 16px 20px; margin: 24px 0; }
  .section { margin-top: 20px; }
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #2d5a27; margin-bottom: 6px; }
  .signatures { display: flex; gap: 40px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #c8d4c0; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #1a2e1a; height: 40px; margin: 8px 0; }
  .sig-label { font-size: 11px; color: #5a6b5a; }
  .footer-note { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e2d0; font-size: 11px; color: #5a6b5a; text-align: center; }
`;

function wrap(title, subtitle, body) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${CSS}</style></head><body>
  <h1>${title}</h1><p class="subtitle">${subtitle}</p>${body}
  <p class="footer-note">Document généré par Zelko · zelko.fr</p></body></html>`;
}

function val(v) { return v || '___'; }

// ─── NDA ────────────────────────────────────────────────────────────────────
function generateNdaHtml(f) {
  const isBilateral = f.accord_type === 'bilateral';
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');
  const div = isBilateral ? 'la Partie divulgatrice' : 'la Partie Divulgatrice';
  const rec = isBilateral ? "l'autre Partie" : 'la Partie Réceptrice';

  const parties = isBilateral ? `
    <p><strong>PARTIE 1 :</strong> ${val(f.p1_name)}, ${val(f.p1_type)}, représentée par ${val(f.p1_rep)}, ${val(f.p1_addr)}, ci-après <strong>« Partie 1 »</strong></p>
    <p><strong>PARTIE 2 :</strong> ${val(f.p2_name)}, ${val(f.p2_type)}, représentée par ${val(f.p2_rep)}, ${val(f.p2_addr)}, ci-après <strong>« Partie 2 »</strong></p>` : `
    <p><strong>PARTIE DIVULGATRICE :</strong> ${val(f.p1_name)}, ${val(f.p1_type)}, représentée par ${val(f.p1_rep)}, ${val(f.p1_addr)}, ci-après <strong>« Partie Divulgatrice »</strong></p>
    <p><strong>PARTIE RÉCEPTRICE :</strong> ${val(f.p2_name)}, ${val(f.p2_type)}, représentée par ${val(f.p2_rep)}, ${val(f.p2_addr)}, ci-après <strong>« Partie Réceptrice »</strong></p>`;

  let clauses = '';
  if (f.cl_penalite) clauses += `<div class="section"><p class="section-title">Article — Pénalité</p><p>En cas de violation, la partie fautive sera redevable d'une pénalité forfaitaire de 10 000 € par infraction constatée.</p></div>`;
  if (f.cl_retour) clauses += `<div class="section"><p class="section-title">Article — Restitution</p><p>À l'expiration du présent accord, ${rec} s'engage à restituer ou détruire l'intégralité des documents confidentiels dans un délai de dix (10) jours ouvrés.</p></div>`;
  if (f.cl_non_solicitation) clauses += `<div class="section"><p class="section-title">Article — Non-sollicitation</p><p>Pendant la durée de l'accord et douze (12) mois après, ${rec} s'interdit de recruter tout collaborateur de ${div} avec qui elle aurait été en contact.</p></div>`;

  const body = `
    <p>Entre les soussignés :</p>
    <div class="parties">${parties}</div>
    <p>Il a été convenu ce qui suit :</p>
    <div class="section"><p class="section-title">Article 1 — Objet</p><p>Dans le cadre de ${val(f.contexte)}, les Parties échangent des informations confidentielles relatives à ${val(f.objet)}. Le présent accord définit les conditions de leur protection.</p></div>
    <div class="section"><p class="section-title">Article 2 — Informations confidentielles</p><p>Sont confidentielles toutes informations, données, savoir-faire, procédés techniques, informations financières ou stratégiques communiquées par ${div} à ${rec}.</p></div>
    <div class="section"><p class="section-title">Article 3 — Obligations</p><p>${rec} s'engage à : (i) garder strictement confidentielles les informations reçues ; (ii) ne pas les divulguer sans accord écrit préalable ; (iii) les utiliser uniquement aux fins prévues ; (iv) prendre toutes mesures de protection nécessaires.</p></div>
    <div class="section"><p class="section-title">Article 4 — Exclusions</p><p>Les obligations ne s'appliquent pas aux informations : (i) devenues publiques sans faute de ${rec} ; (ii) déjà détenues avant communication ; (iii) reçues légitimement d'un tiers ; (iv) dont la divulgation est exigée par la loi.</p></div>
    <div class="section"><p class="section-title">Article 5 — Durée</p><p>Le présent accord est conclu pour <strong>${val(f.duree)} an(s)</strong> à compter de sa signature.</p></div>
    <div class="section"><p class="section-title">Article 6 — Droit applicable</p><p>Le présent accord est soumis au droit français. Tout litige relève des tribunaux de Paris.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires.</p>
    <div class="signatures">
      <div class="sig-block"><p class="sig-label">Pour ${val(f.p1_name)}</p><div class="sig-line"></div><p class="sig-label">${val(f.p1_rep)}</p></div>
      <div class="sig-block"><p class="sig-label">Pour ${val(f.p2_name)}</p><div class="sig-line"></div><p class="sig-label">${val(f.p2_rep)}</p></div>
    </div>`;
  return wrap('Accord de Confidentialité', isBilateral ? 'Accord Bilatéral — NDA' : 'Accord Unilatéral — NDA', body);
}

// ─── PRESTATION ─────────────────────────────────────────────────────────────
function generatePrestationHtml(f) {
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');
  let clauses = '';
  if (f.cl_pi) clauses += `<div class="section"><p class="section-title">Article — Propriété intellectuelle</p><p>L'ensemble des livrables et créations réalisés dans le cadre de la mission sont cédés au Client à compter du paiement intégral de la prestation.</p></div>`;
  if (f.cl_conf) clauses += `<div class="section"><p class="section-title">Article — Confidentialité</p><p>Le Prestataire s'engage à garder confidentielles toutes les informations communiquées par le Client dans le cadre de la mission, pendant sa durée et cinq (5) ans après.</p></div>`;
  if (f.cl_exclu) clauses += `<div class="section"><p class="section-title">Article — Exclusivité</p><p>Le Prestataire s'engage à ne pas réaliser de mission similaire pour un concurrent direct du Client pendant la durée du contrat.</p></div>`;
  if (f.cl_penalite) clauses += `<div class="section"><p class="section-title">Article — Pénalités de retard</p><p>En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.</p></div>`;
  if (f.cl_non_concurrence) clauses += `<div class="section"><p class="section-title">Article — Non-concurrence</p><p>Le Prestataire s'interdit d'exercer une activité concurrente à celle du Client pendant la durée de la mission et six (6) mois après.</p></div>`;

  const body = `
    <p>Entre les soussignés :</p>
    <div class="parties">
      <p><strong>PRESTATAIRE :</strong> ${val(f.p1_name)}, ${val(f.p1_type)}${f.p1_siret ? `, SIRET ${f.p1_siret}` : ''}, représenté par ${val(f.p1_rep)}, ${val(f.p1_addr)}, ci-après <strong>« le Prestataire »</strong></p>
      <p><strong>CLIENT :</strong> ${val(f.p2_name)}, ${val(f.p2_type)}, représenté par ${val(f.p2_rep)}, ${val(f.p2_addr)}, ci-après <strong>« le Client »</strong></p>
    </div>
    <p>Il a été convenu ce qui suit :</p>
    <div class="section"><p class="section-title">Article 1 — Objet et mission</p><p>${val(f.mission)}</p></div>
    <div class="section"><p class="section-title">Article 2 — Livrables</p><p>${val(f.livrables)}</p></div>
    <div class="section"><p class="section-title">Article 3 — Durée</p><p>La mission débute le <strong>${val(f.date_debut)}</strong>${f.date_fin ? ` et se termine le <strong>${f.date_fin}</strong>` : ''}.</p></div>
    <div class="section"><p class="section-title">Article 4 — Rémunération</p><p>La prestation est rémunérée <strong>${val(f.montant)} €</strong> (${val(f.facturation)}). Règlement sous <strong>${val(f.paiement)}</strong>.</p></div>
    <div class="section"><p class="section-title">Article 5 — Indépendance</p><p>Le Prestataire agit en qualité de prestataire indépendant. Le présent contrat ne saurait être requalifié en contrat de travail.</p></div>
    <div class="section"><p class="section-title">Article 6 — Résiliation</p><p>Chaque partie peut résilier le présent contrat avec un préavis de quinze (15) jours par lettre recommandée avec accusé de réception.</p></div>
    <div class="section"><p class="section-title">Article 7 — Droit applicable</p><p>Le présent contrat est soumis au droit français. Tout litige relève des tribunaux de Paris.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires.</p>
    <div class="signatures">
      <div class="sig-block"><p class="sig-label">Le Prestataire — ${val(f.p1_name)}</p><div class="sig-line"></div><p class="sig-label">${val(f.p1_rep)}</p></div>
      <div class="sig-block"><p class="sig-label">Le Client — ${val(f.p2_name)}</p><div class="sig-line"></div><p class="sig-label">${val(f.p2_rep)}</p></div>
    </div>`;
  return wrap('Contrat de Prestation de Services', 'Contrat de prestation indépendante', body);
}

// ─── CGV ────────────────────────────────────────────────────────────────────
function generateCgvHtml(f) {
  const today = f.date_maj || new Date().toLocaleDateString('fr-FR');
  const isB2C = (f.client_type || 'b2c') === 'b2c';

  let clauses = '';
  if (f.cl_garantie) clauses += `<div class="section"><p class="section-title">Article — Garantie légale</p><p>Conformément aux articles L.217-4 et suivants du Code de la consommation, le vendeur est tenu à la garantie légale de conformité et à la garantie contre les vices cachés.</p></div>`;
  if (f.cl_donnees) clauses += `<div class="section"><p class="section-title">Article — Protection des données</p><p>Les données personnelles collectées sont traitées conformément au RGPD (UE 2016/679). Le Client dispose d'un droit d'accès, de rectification et de suppression de ses données.</p></div>`;
  if (f.cl_force) clauses += `<div class="section"><p class="section-title">Article — Force majeure</p><p>Le vendeur ne pourra être tenu responsable de l'inexécution de ses obligations en cas de force majeure au sens de l'article 1218 du Code civil.</p></div>`;
  if (f.cl_mediation) clauses += `<div class="section"><p class="section-title">Article — Médiation</p><p>Conformément à l'article L.616-1 du Code de la consommation, le Client peut recourir gratuitement au service de médiation compétent en cas de litige.</p></div>`;

  const body = `
    <div class="parties">
      <p><strong>${val(f.nom)}</strong>, ${val(f.forme)}${f.capital ? `, capital de ${f.capital} €` : ''}</p>
      <p>Siège social : ${val(f.siege)}</p>
      <p>SIRET : ${val(f.siret)} — TVA : ${val(f.tva)}</p>
      <p>Email : ${val(f.email)}${f.telephone ? ` — Tél : ${f.telephone}` : ''}${f.site ? ` — ${f.site}` : ''}</p>
    </div>
    <div class="section"><p class="section-title">Article 1 — Objet et champ d'application</p><p>Les présentes Conditions Générales de Vente régissent les ventes de ${val(f.activite)} réalisées par ${val(f.nom)} auprès de ses clients ${isB2C ? 'particuliers (B2C)' : 'professionnels (B2B)'}.</p></div>
    <div class="section"><p class="section-title">Article 2 — Commandes</p><p>Toute commande implique l'acceptation pleine et entière des présentes CGV. Le contrat est conclu dès la confirmation de commande adressée par email.</p></div>
    <div class="section"><p class="section-title">Article 3 — Prix</p><p>Les prix sont indiqués en euros TTC. Le vendeur se réserve le droit de modifier ses prix à tout moment.</p></div>
    <div class="section"><p class="section-title">Article 4 — Paiement</p><p>Le règlement s'effectue par ${val(f.paiement)}. Le paiement est exigible à la commande.</p></div>
    <div class="section"><p class="section-title">Article 5 — Livraison</p><p>Les délais de livraison sont de ${val(f.delai)}. Le vendeur ne saurait être tenu responsable des retards imputables au transporteur.</p></div>
    ${isB2C ? `<div class="section"><p class="section-title">Article 6 — Droit de rétractation</p><p>Conformément à l'article L.221-18 du Code de la consommation, le Client dispose de ${val(f.retractation)} à compter de la réception pour exercer son droit de rétractation, sans motif.</p></div>` : ''}
    <div class="section"><p class="section-title">Article ${isB2C ? 7 : 6} — Responsabilité</p><p>La responsabilité du vendeur ne saurait être engagée pour les dommages indirects ou imprévisibles résultant de l'utilisation des produits ou services.</p></div>
    <div class="section"><p class="section-title">Article ${isB2C ? 8 : 7} — Droit applicable</p><p>Les présentes CGV sont soumises au droit français. Tout litige relève des tribunaux de Paris.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Mise à jour : <strong>${today}</strong></p>`;
  return wrap('Conditions Générales de Vente', `${val(f.nom)} — ${isB2C ? 'B2C' : 'B2B'}`, body);
}

// ─── BAIL HABITATION ────────────────────────────────────────────────────────
function generateBailHabitationHtml(f) {
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');
  const isMeuble = f.mobilier === 'meuble';

  let clauses = '';
  if (f.cl_animaux) clauses += `<div class="section"><p class="section-title">Article — Animaux domestiques</p><p>Le Locataire est autorisé à détenir des animaux domestiques dans le logement, sous réserve qu'ils ne causent pas de nuisances aux voisins.</p></div>`;
  if (f.cl_no_animaux) clauses += `<div class="section"><p class="section-title">Article — Interdiction d'animaux</p><p>Il est strictement interdit de détenir tout animal dans le logement, à l'exception des animaux de compagnie de petite taille en cage.</p></div>`;
  if (f.cl_colocation) clauses += `<div class="section"><p class="section-title">Article — Colocation</p><p>Le présent bail est consenti à titre de colocation. Chaque colocataire est tenu solidairement au paiement de l'intégralité du loyer et des charges.</p></div>`;
  if (f.cl_clause_resolutoire) clauses += `<div class="section"><p class="section-title">Article — Clause résolutoire</p><p>Le présent bail sera résilié de plein droit, après commandement demeuré infructueux pendant deux (2) mois, en cas de non-paiement du loyer ou des charges, de non-versement du dépôt de garantie, ou de défaut d'assurance.</p></div>`;

  const body = `
    <p>Entre les soussignés :</p>
    <div class="parties">
      <p><strong>BAILLEUR :</strong> ${val(f.bail_nom)}${f.bail_qualite ? `, ${f.bail_qualite}` : ''}${f.bail_rep ? `, représenté par ${f.bail_rep}` : ''}, ${val(f.bail_addr)}, ci-après <strong>« le Bailleur »</strong></p>
      <p><strong>LOCATAIRE :</strong> ${val(f.loc_prenom)} ${val(f.loc_nom)}${f.loc_naissance ? `, né(e) le ${f.loc_naissance}` : ''}${f.loc_lieu_naissance ? ` à ${f.loc_lieu_naissance}` : ''}, ${val(f.loc_addr)}, ci-après <strong>« le Locataire »</strong></p>
      ${f.garant_nom ? `<p><strong>GARANT :</strong> ${f.garant_nom}, ${val(f.garant_addr)}, se portant fort en qualité de ${f.garant_type || 'caution solidaire'}</p>` : ''}
    </div>
    <p>Il a été convenu ce qui suit :</p>
    <div class="section"><p class="section-title">Article 1 — Objet</p><p>Le Bailleur loue au Locataire le bien situé <strong>${val(f.bien_addr)}</strong> — ${val(f.bien_desc)}, ${val(f.bien_surface)} m², ${val(f.bien_pieces)} pièce(s), ${f.bien_etage ? `étage ${f.bien_etage}` : ''}. Chauffage : ${val(f.bien_chauffage)}. DPE : ${val(f.bien_dpe)}. Bail ${isMeuble ? 'meublé' : 'vide'} soumis à la loi du 6 juillet 1989.</p></div>
    <div class="section"><p class="section-title">Article 2 — Durée</p><p>Le bail prend effet le <strong>${val(f.date_debut)}</strong> pour une durée de <strong>${val(f.duree)}</strong>.</p></div>
    <div class="section"><p class="section-title">Article 3 — Loyer et charges</p><p>Loyer mensuel : <strong>${val(f.loyer)} €</strong>. Charges : <strong>${val(f.charges)} €</strong> (${val(f.charges_mode)}). Dépôt de garantie : <strong>${val(f.depot)} €</strong>. Paiement le <strong>${val(f.date_paiement)}</strong> de chaque mois par ${val(f.paiement)}.</p></div>
    <div class="section"><p class="section-title">Article 4 — Obligations du Locataire</p><p>Le Locataire s'engage à : (i) payer le loyer et les charges aux échéances convenues ; (ii) user paisiblement des locaux ; (iii) souscrire une assurance habitation et en justifier ; (iv) ne pas transformer les lieux sans accord écrit.</p></div>
    <div class="section"><p class="section-title">Article 5 — Obligations du Bailleur</p><p>Le Bailleur s'engage à : (i) délivrer le logement en bon état ; (ii) assurer la jouissance paisible ; (iii) prendre en charge les réparations autres que locatives ; (iv) restituer le dépôt de garantie dans les délais légaux.</p></div>
    <div class="section"><p class="section-title">Article 6 — Résiliation</p><p>Congé du Bailleur : préavis de 6 mois pour reprise ou vente, 3 mois pour motif légitime et sérieux. Congé du Locataire : préavis de ${f.cl_resiliation_anticipee ? '1 mois (zone tendue)' : '3 mois'} pour logement vide${isMeuble ? ', 1 mois pour logement meublé' : ''}.</p></div>
    <div class="section"><p class="section-title">Article 7 — Droit applicable</p><p>Le présent bail est soumis à la loi du 6 juillet 1989 et à la loi ALUR du 24 mars 2014.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires.</p>
    <div class="signatures">
      <div class="sig-block"><p class="sig-label">Le Bailleur — ${val(f.bail_nom)}</p><div class="sig-line"></div><p class="sig-label">Signature précédée de la mention « Lu et approuvé »</p></div>
      <div class="sig-block"><p class="sig-label">Le Locataire — ${val(f.loc_prenom)} ${val(f.loc_nom)}</p><div class="sig-line"></div><p class="sig-label">Signature précédée de la mention « Lu et approuvé »</p></div>
    </div>`;
  return wrap("Contrat de Bail d'Habitation", isMeuble ? 'Bail meublé — Loi du 6 juillet 1989' : 'Bail vide — Loi du 6 juillet 1989', body);
}

// ─── BAIL COMMERCIAL ────────────────────────────────────────────────────────
function generateBailCommercialHtml(f) {
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');

  let clauses = '';
  if (f.cl_cession_bail) clauses += `<div class="section"><p class="section-title">Article — Cession de bail</p><p>Le Preneur peut céder le présent bail à l'acquéreur de son fonds de commerce, sous réserve d'en informer le Bailleur par acte extrajudiciaire.</p></div>`;
  if (f.cl_travaux) clauses += `<div class="section"><p class="section-title">Article — Travaux</p><p>Les travaux de mise aux normes incombent au Bailleur. Les travaux d'aménagement réalisés par le Preneur restent acquis au Bailleur en fin de bail, sauf accord contraire.</p></div>`;
  if (f.cl_droit_preference) clauses += `<div class="section"><p class="section-title">Article — Droit de préférence</p><p>En cas de vente du local, le Preneur bénéficie d'un droit de préférence et devra être informé en priorité des conditions de cession.</p></div>`;

  const body = `
    <p>Entre les soussignés :</p>
    <div class="parties">
      <p><strong>BAILLEUR :</strong> ${val(f.bail_nom)}${f.bail_qualite ? `, ${f.bail_qualite}` : ''}${f.bail_rep ? `, représenté par ${f.bail_rep}` : ''}, ${val(f.bail_addr)}, ci-après <strong>« le Bailleur »</strong></p>
      <p><strong>PRENEUR :</strong> ${val(f.pren_nom)}, ${val(f.pren_type)}${f.pren_siret ? `, SIRET ${f.pren_siret}` : ''}${f.pren_rep ? `, représenté par ${f.pren_rep}` : ''}, ${val(f.pren_addr)}, ci-après <strong>« le Preneur »</strong></p>
    </div>
    <p>Il a été convenu ce qui suit :</p>
    <div class="section"><p class="section-title">Article 1 — Objet</p><p>Le Bailleur donne à bail au Preneur le local situé <strong>${val(f.local_addr)}</strong> — ${val(f.local_desc)}, surface de ${val(f.local_surface)} m², en état ${val(f.local_etat)}. Activité autorisée : ${val(f.local_activite)}.</p></div>
    <div class="section"><p class="section-title">Article 2 — Durée</p><p>Le bail prend effet le <strong>${val(f.date_debut)}</strong> pour une durée de <strong>${val(f.duree)}</strong>, conformément aux dispositions de l'article L.145-4 du Code de commerce.</p></div>
    <div class="section"><p class="section-title">Article 3 — Loyer</p><p>Loyer annuel : <strong>${val(f.loyer_p1)} €</strong>. Charges : ${val(f.charges)}. Révision basée sur l'indice ${val(f.indice)}. Dépôt de garantie : ${val(f.garantie_montant)} €.</p></div>
    <div class="section"><p class="section-title">Article 4 — Destination des lieux</p><p>Le Preneur s'engage à exploiter les lieux exclusivement pour l'activité de ${val(f.local_activite)}, à l'exclusion de tout autre usage.</p></div>
    <div class="section"><p class="section-title">Article 5 — Renouvellement</p><p>Conformément à l'article L.145-8 du Code de commerce, le Preneur bénéficie d'un droit au renouvellement du présent bail. Le congé doit être notifié avec un préavis de six (6) mois.</p></div>
    <div class="section"><p class="section-title">Article 6 — Charges et taxes</p><p>Répartition des charges selon les dispositions de la loi Pinel du 18 juin 2014. La taxe foncière reste à la charge du Bailleur, sauf stipulation contraire.</p></div>
    <div class="section"><p class="section-title">Article 7 — Droit applicable</p><p>Le présent bail est soumis aux articles L.145-1 et suivants du Code de commerce et à la loi Pinel du 18 juin 2014.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires.</p>
    <div class="signatures">
      <div class="sig-block"><p class="sig-label">Le Bailleur — ${val(f.bail_nom)}</p><div class="sig-line"></div><p class="sig-label">Signature précédée de la mention « Lu et approuvé »</p></div>
      <div class="sig-block"><p class="sig-label">Le Preneur — ${val(f.pren_nom)}</p><div class="sig-line"></div><p class="sig-label">Signature précédée de la mention « Lu et approuvé »</p></div>
    </div>`;
  return wrap('Bail Commercial', 'Statut des baux commerciaux — Art. L.145-1 C. com.', body);
}

// ─── CONTRAT DE TRAVAIL ─────────────────────────────────────────────────────
function generateContratTravailHtml(f) {
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');
  const isCDD = !!f.date_fin;

  let clauses = '';
  if (f.cl_teletravail) clauses += `<div class="section"><p class="section-title">Article — Télétravail</p><p>Le Salarié pourra exercer ses fonctions en télétravail selon les modalités définies par accord d'entreprise ou charte applicable, après validation de l'Employeur.</p></div>`;
  if (f.cl_conf) clauses += `<div class="section"><p class="section-title">Article — Confidentialité</p><p>Le Salarié s'engage à garder strictement confidentielles toutes les informations dont il aura connaissance dans l'exercice de ses fonctions, pendant et après l'exécution du contrat.</p></div>`;
  if (f.cl_nc) clauses += `<div class="section"><p class="section-title">Article — Non-concurrence</p><p>Pendant une durée de douze (12) mois suivant la rupture du contrat, le Salarié s'interdit d'exercer une activité concurrente, en contrepartie d'une indemnité mensuelle de non-concurrence.</p></div>`;
  if (f.cl_objectifs) clauses += `<div class="section"><p class="section-title">Article — Objectifs et variable</p><p>Une partie de la rémunération peut être variable, conditionnée à l'atteinte d'objectifs définis annuellement lors d'un entretien avec l'Employeur.</p></div>`;

  const body = `
    <p>Entre les soussignés :</p>
    <div class="parties">
      <p><strong>EMPLOYEUR :</strong> ${val(f.emp_nom)}, ${val(f.emp_forme)}${f.emp_siret ? `, SIRET ${f.emp_siret}` : ''}, ${val(f.emp_addr)}, représenté par ${val(f.emp_rep)}, ci-après <strong>« l'Employeur »</strong></p>
      <p><strong>SALARIÉ :</strong> ${val(f.sal_prenom)} ${val(f.sal_nom)}${f.sal_naissance ? `, né(e) le ${f.sal_naissance}` : ''}${f.sal_nat ? `, de nationalité ${f.sal_nat}` : ''}, ${val(f.sal_addr)}, ci-après <strong>« le Salarié »</strong></p>
    </div>
    <p>Il a été convenu ce qui suit :</p>
    <div class="section"><p class="section-title">Article 1 — Nature et durée du contrat</p><p>Le présent contrat est un <strong>${isCDD ? 'CDD' : 'CDI'}</strong>${isCDD ? ` conclu du <strong>${val(f.date_debut)}</strong> au <strong>${val(f.date_fin)}</strong> pour le motif suivant : ${val(f.motif_cdd)}` : ` à durée indéterminée prenant effet le <strong>${val(f.date_debut)}</strong>`}.</p></div>
    <div class="section"><p class="section-title">Article 2 — Poste et missions</p><p>Le Salarié est engagé en qualité de <strong>${val(f.poste)}</strong>, lieu de travail : ${val(f.lieu)}. Ses missions principales : ${val(f.missions)}.</p></div>
    <div class="section"><p class="section-title">Article 3 — Durée du travail</p><p>La durée du travail est de <strong>${val(f.duree_hebdo)} heures</strong> par semaine, conformément à la convention collective ${val(f.convention)}.</p></div>
    <div class="section"><p class="section-title">Article 4 — Rémunération</p><p>Le Salarié percevra un salaire brut mensuel de <strong>${val(f.salaire)} €</strong>.</p></div>
    <div class="section"><p class="section-title">Article 5 — Période d'essai</p><p>Le contrat est soumis à une période d'essai de <strong>${val(f.essai)}</strong>, renouvelable une fois dans les conditions légales.</p></div>
    <div class="section"><p class="section-title">Article 6 — Convention collective</p><p>Le Salarié relève de la convention collective ${val(f.convention)}.</p></div>
    <div class="section"><p class="section-title">Article 7 — Droit applicable</p><p>Le présent contrat est soumis au droit français du travail, notamment aux articles L.1221-1 et suivants du Code du travail.</p></div>
    ${clauses}
    ${f.clause_custom ? `<div class="section"><p class="section-title">Clause personnalisée</p><p>${f.clause_custom}</p></div>` : ''}
    <p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires.</p>
    <div class="signatures">
      <div class="sig-block"><p class="sig-label">L'Employeur — ${val(f.emp_nom)}</p><div class="sig-line"></div><p class="sig-label">${val(f.emp_rep)}</p></div>
      <div class="sig-block"><p class="sig-label">Le Salarié — ${val(f.sal_prenom)} ${val(f.sal_nom)}</p><div class="sig-line"></div><p class="sig-label">Précédé de « Lu et approuvé »</p></div>
    </div>`;
  return wrap(`Contrat de Travail — ${isCDD ? 'CDD' : 'CDI'}`, `${val(f.emp_nom)}`, body);
}

// ─── PDF via PDFShift ────────────────────────────────────────────────────────
async function htmlToPdf(html) {
  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.PDFSHIFT_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: html, landscape: false, use_print: false }),
  });
  if (!response.ok) throw new Error(`PDFShift error: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

// ─── WEBHOOK ────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const contractType = session.metadata?.contractType;
    let formData = {};
    try { formData = JSON.parse(session.metadata?.formData || '{}'); } catch (e) {}

    const contracts = {
      'nda':              { fn: generateNdaHtml,            label: 'Accord de confidentialité (NDA)',  file: 'accord-confidentialite-zelko.pdf' },
      'prestation':       { fn: generatePrestationHtml,     label: 'Contrat de prestation de services', file: 'contrat-prestation-zelko.pdf' },
      'cgv':              { fn: generateCgvHtml,            label: 'Conditions Générales de Vente',     file: 'cgv-zelko.pdf' },
      'bail-habitation':  { fn: generateBailHabitationHtml, label: "Bail d'habitation",                 file: 'bail-habitation-zelko.pdf' },
      'bail-commercial':  { fn: generateBailCommercialHtml, label: 'Bail commercial',                   file: 'bail-commercial-zelko.pdf' },
      'contrat-travail':  { fn: generateContratTravailHtml, label: 'Contrat de travail',                file: 'contrat-travail-zelko.pdf' },
    };

    const contract = contracts[contractType];
    if (!contract) return res.status(200).json({ received: true });

    try {
      const html = contract.fn(formData);
      const pdfBuffer = await htmlToPdf(html);
      const pdfBase64 = pdfBuffer.toString('base64');

      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: customerEmail,
        subject: `Votre ${contract.label} — Zelko`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2e1a;">
            <div style="background: #1a2e1a; padding: 24px 32px;">
              <h1 style="color: white; font-size: 22px; margin: 0; font-weight: 400; letter-spacing: 0.05em;">ZEL<span style="color: #4a7c42;">KO</span></h1>
            </div>
            <div style="padding: 32px; background: #f4f1ea; border: 1px solid #c8d4c0;">
              <p style="font-size: 15px; margin-bottom: 16px;">Bonjour,</p>
              <p style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">Merci pour votre achat. Votre <strong>${contract.label}</strong> est prêt.</p>
              <p style="font-size: 14px; line-height: 1.7; margin-bottom: 24px;">Vous trouverez votre contrat en pièce jointe au format PDF, prêt à être imprimé et signé.</p>
              <p style="font-size: 13px; color: #5a6b5a;">Pour toute question : <a href="mailto:contact@zelko.fr" style="color: #2d5a27;">contact@zelko.fr</a></p>
            </div>
            <div style="padding: 16px 32px; text-align: center;">
              <p style="font-size: 11px; color: #5a6b5a;">© 2026 Zelko · zelko.fr</p>
            </div>
          </div>`,
        attachments: [{ filename: contract.file, content: pdfBase64 }],
      });
    } catch (err) {
      console.error('Erreur génération PDF ou envoi email:', err);
    }
  }

  res.status(200).json({ received: true });
};
