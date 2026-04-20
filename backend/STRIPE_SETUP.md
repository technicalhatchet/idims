# Stripe Payment Integration Setup

## Environment Variables Required

Add these environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Stripe Account Setup

1. **Create a Stripe Account**: Sign up at [stripe.com](https://stripe.com)

2. **Get Your API Keys**:
   - Go to Stripe Dashboard → Developers → API Keys
   - Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)
   - Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)

3. **Set Up Webhooks**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `http://localhost:8000/api/stripe/webhook`
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the **Webhook Secret** (starts with `whsec_`)

## Testing

### Test Mode
- Use test API keys (start with `sk_test_` and `pk_test_`)
- Use test card numbers: `4242 4242 4242 4242`
- Any future expiry date and any 3-digit CVC

### Live Mode
- Replace test keys with live keys
- Update webhook endpoint to your production URL
- Test with real payment methods

## Features Implemented

✅ **Stripe Checkout Integration**
- Secure payment processing
- PCI compliance handled by Stripe
- Support for all major payment methods

✅ **Automatic Billing Updates**
- Services automatically marked as "paid" after successful payment
- Work order totals updated in real-time
- Payment history tracked

✅ **Webhook Handling**
- Automatic payment confirmation
- Failed payment notifications
- Background processing for reliability

✅ **User Experience**
- Clean payment button in invoice tab
- Success/cancellation handling
- Real-time updates after payment

## Usage

1. **For Clients**: Click "Pay $X.XX" button in the invoice tab
2. **For Admins**: Use admin controls for manual payment processing
3. **For Testing**: Use Stripe test card numbers

## Security

- All payment data is handled securely by Stripe
- No credit card information is stored in your database
- Webhooks are verified using Stripe signatures
- PCI compliance maintained through Stripe Checkout

