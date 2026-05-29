const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;

    try {
      await resend.emails.send({
        from: 'Zelko <contact@zelko.fr>',
        to: customerEmail,
        subject: 'Votre document Zelko est prêt',
        html: '<p>Bonjour,</p><p>Merci pour votre achat. Votre document est disponible sur zelko.fr.</p><p>L\'équipe Zelko</p>',
      });
    } catch (err) {
      console.error('Erreur envoi email:', err);
    }
  }

  res.status(200).json({ received: true });
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
