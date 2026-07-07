Apple Pay domain verification (Square)
=====================================

Square requires this file for Apple Pay on the web:

  /.well-known/apple-developer-merchantid-domain-association

Steps:
1. Square Developer Console → your app → Apple Pay
2. Add your HTTPS domain (sandbox and/or production)
3. Download the domain association file Square provides
4. Save it here as:

   frontend/public/.well-known/apple-developer-merchantid-domain-association

   (no file extension)

5. Redeploy the frontend. Verify:
   https://YOUR-DOMAIN/.well-known/apple-developer-merchantid-domain-association

Apple Pay does not work on http://localhost — use HTTPS staging or production.
