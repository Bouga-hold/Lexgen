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

function generateNdaHtml(f) {
  const isBilateral = f.accord_type === 'bilateral';
  const today = f.date_sign || new Date().toLocaleDateString('fr-FR');

  const partiesBlock = isBilateral ? `
    <p><strong>PARTIE 1 :</strong> ${f.p1_name || '___'}, ${f.p1_type || '___'}, représentée par ${f.p1_rep || '___'}, dont le siège est situé ${f.p1_addr || '___'}, ci-après dénommée <strong>« Partie 1 »</strong></p>
    <p style="margin-top:8px"><strong>PARTIE 2 :</strong> ${f.p2_name || '___'}, ${f.p2_type || '___'}, représentée par ${f.p2_rep || '___'}, dont le siège est situé ${f.p2_addr || '___'}, ci-après dénommée <strong>« Partie 2 »</strong></p>
  ` : `
    <p><strong>PARTIE DIVULGATRICE :</strong> ${f.p1_name || '___'}, ${f.p1_type || '___'}, représentée par ${f.p1_rep || '___'}, dont le siège est situé ${f.p1_addr || '___'}, ci-après dénommée <strong>« Partie Divulgatrice »</strong></p>
    <p style="margin-top:8px"><strong>PARTIE RÉCEPTRICE :</strong> ${f.p2_name || '___'}, ${f.p2_type || '___'}, représentée par ${f.p2_rep || '___'}, dont le siège est situé ${f.p2_addr || '___'}, ci-après dénommée <strong>« Partie Réceptrice »</strong></p>
  `;

  const divulgatrice = isBilateral ? 'la Partie divulgatrice' : 'la Partie Divulgatrice';
  const receptrice = isBilateral ? "l'autre Partie" : 'la Partie Réceptrice';

  let clausesOptionnelles = '';
  if (f.cl_penalite) clausesOptionnelles += `
    <div style="margin-top:16px">
      <p style="font-weight:600;text-transform:uppercase;font-size:12px;color:#2d5a27;margin-bottom:6px">Article — Pénalité en cas de violation</p>
      <p>En cas de violation des obligations de confidentialité, la partie fautive sera redevable d'une pénalité forfaitaire de 10 000 € par infraction constatée, sans préjudice de tout autre recours en dommages-intérêts.</p>
    </div>`;
  if (f.cl_retour) clausesOptionnelles += `
    <div style="margin-top:16px">
      <p style="font-weight:600;text-transform:uppercase;font-size:12px;color:#2d5a27;margin-bottom:6px">Article — Restitution des documents</p>
      <p>À la demande de ${divulgatrice} ou à l'expiration du présent accord, ${receptrice} s'engage à restituer ou à détruire l'intégralité des documents confidentiels en sa possession dans un délai de dix (10) jours ouvrés.</p>
    </div>`;
  if (f.cl_non_solicitation) clausesOptionnelles += `
    <div style="margin-top:16px">
      <p style="font-weight:600;text-transform:uppercase;font-size:12px;color:#2d5a27;margin-bottom:6px">Article — Non-sollicitation</p>
      <p>Pendant la durée du présent accord et durant une période de douze (12) mois suivant son expiration, ${receptrice} s'interdit de solliciter, recruter ou débaucher tout collaborateur de ${divulgatrice} avec qui elle aurait été en contact dans le cadre du présent accord.</p>
    </div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; font-size: 13px; line-height: 1.8; color: #1a2e1a; max-width: 750px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 20px; text-align: center; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #1a2e1a; padding-bottom: 16px; margin-bottom: 8px; }
  .subtitle { text-align: center; font-size: 11px; color: #5a6b5a; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 32px; }
  .parties { background: #f0f4ee; border-left: 3px solid #2d5a27; padding: 16px 20px; margin: 24px 0; border-radius: 0 4px 4px 0; }
  .section { margin-top: 20px; }
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #2d5a27; margin-bottom: 6px; }
  .signatures { display: flex; gap: 40px; margin-top: 40px; padding-top: 24px; border-top: 1px solid #c8d4c0; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #1a2e1a; height: 40px; margin: 8px 0; }
  .sig-label { font-size: 11px; color: #5a6b5a; }
  .footer-note { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e2d0; font-size: 11px; color: #5a6b5a; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<h1>Accord de Confidentialité</h1>
<p class="subtitle">${isBilateral ? 'Accord Bilatéral' : 'Accord Unilatéral'} — NDA</p>

<p>Entre les soussignés :</p>
<div class="parties">${partiesBlock}</div>
<p>Ci-après dénommées collectivement <strong>« les Parties »</strong>,</p>
<p style="margin-top:12px">Il a été convenu ce qui suit :</p>

<div class="section">
  <p class="section-title">Article 1 — Objet</p>
  <p>Dans le cadre de ${f.contexte || 'leurs relations professionnelles'}, les Parties sont amenées à échanger des informations confidentielles relatives à ${f.objet || 'leur activité respective'}. Le présent accord a pour objet de définir les conditions dans lesquelles ces informations seront protégées.</p>
</div>

<div class="section">
  <p class="section-title">Article 2 — Définition des informations confidentielles</p>
  <p>Sont considérées comme confidentielles toutes les informations, données, documents, savoir-faire, procédés techniques, informations financières, commerciales ou stratégiques, communiquées par ${divulgatrice} à ${receptrice}, sous quelque forme que ce soit, dans le cadre du présent accord.</p>
</div>

<div class="section">
  <p class="section-title">Article 3 — Obligations de confidentialité</p>
  <p>${receptrice} s'engage à : (i) garder strictement confidentielles les informations reçues ; (ii) ne pas les divulguer à des tiers sans accord écrit préalable de ${divulgatrice} ; (iii) n'utiliser ces informations qu'aux fins des discussions prévues ; (iv) prendre toutes mesures nécessaires pour en assurer la protection.</p>
</div>

<div class="section">
  <p class="section-title">Article 4 — Exclusions</p>
  <p>Les obligations de confidentialité ne s'appliquent pas aux informations : (i) qui sont ou deviennent publiques sans faute de ${receptrice} ; (ii) que ${receptrice} détenait déjà avant leur communication ; (iii) reçues légitimement d'un tiers sans restriction ; (iv) dont la divulgation est exigée par la loi ou une autorité compétente.</p>
</div>

<div class="section">
  <p class="section-title">Article 5 — Durée</p>
  <p>Le présent accord est conclu pour une durée de <strong>${f.duree || '2'} an(s)</strong> à compter de sa signature. Les obligations de confidentialité survivront à l'expiration ou à la résiliation du présent accord.</p>
</div>

<div class="section">
  <p class="section-title">Article 6 — Droit applicable et juridiction compétente</p>
  <p>Le présent accord est soumis au droit français. Tout litige relatif à son interprétation ou à son exécution sera soumis à la compétence exclusive des tribunaux compétents de Paris, sauf disposition légale contraire.</p>
</div>

${clausesOptionnelles}

<p style="margin-top:24px">Fait à __________, le <strong>${today}</strong>, en deux exemplaires originaux.</p>

<div class="signatures">
  <div class="sig-block">
    <p class="sig-label">Pour ${f.p1_name || 'Partie 1'}</p>
    <div class="sig-line"></div>
    <p class="sig-label">Nom et qualité : ${f.p1_rep || '___'}</p>
  </div>
  <div class="sig-block">
    <p class="sig-label">Pour ${f.p2_name || 'Partie 2'}</p>
    <div class="sig-line"></div>
    <p class="sig-label">Nom et qualité : ${f.p2_rep || '___'}</p>
  </div>
</div>

<p class="footer-note">Document généré par Zelko · zelko.fr · Pour imprimer en PDF : Fichier → Imprimer → Enregistrer en PDF</p>

</body>
</html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const contractType = session.metadata?.contractType;
    let formData = {};

    try {
      formData = JSON.parse(session.metadata?.formData || '{}');
    } catch (e) {
      console.error('Erreur parsing formData:', e);
    }

    let contractHtml = '';
    let contractLabel = 'Votre contrat';

    if (contractType === 'nda') {
      contractHtml = generateNdaHtml(formData);
      contractLabel = 'Accord de confidentialité (NDA)';
    }
    // Les autres types de contrats seront ajoutés ici (prestation, cgv, etc.)

    const emailHtml = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2e1a;">
        <div style="background: #1a2e1a; padding: 24px 32px;">
          <h1 style="color: white; font-size: 22px; margin: 0; font-weight: 400;">Zel<span style="color: #4a7c42;">ko</span></h1>
        </div>
        <div style="padding: 32px; background: #f4f1ea; border: 1px solid #c8d4c0;">
          <p style="font-size: 15px; margin-bottom: 16px;">Bonjour,</p>
          <p style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">Merci pour votre achat. Votre <strong>${contractLabel}</strong> est prêt.</p>
          <p style="font-size: 14px; line-height: 1.7; margin-bottom: 24px;">Vous trouverez votre contrat complet ci-dessous. Pour le sauvegarder en PDF, ouvrez cet email dans un navigateur puis faites <strong>Fichier → Imprimer → Enregistrer en PDF</strong>.</p>
          <hr style="border: none; border-top: 1px solid #c8d4c0; margin: 24px 0;">
          ${contractHtml}
        </div>
        <div style="padding: 16px 32px; text-align: center;">
          <p style="font-size: 11px; color: #5a6b5a;">© 2026 Zelko · zelko.fr · contact@zelko.fr</p>
        </div>
      </div>
    `;

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: customerEmail,
        subject: `Votre ${contractLabel} — Zelko`,
        html: emailHtml,
      });
    } catch (err) {
      console.error('Erreur envoi email:', err);
    }
  }

  res.status(200).json({ received: true });
};
