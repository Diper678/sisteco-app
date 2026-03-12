// convex/auth.config.ts
// Clerk JWT validation for Convex multi-tenant auth
// Source: https://docs.convex.dev/auth/clerk
//
// Requirements:
//   1. Clerk Dashboard → JWT Templates → create template named "convex"
//   2. Add custom claim: org_id = {{org.id}}
//   3. Set CLERK_JWT_ISSUER_DOMAIN in .env (and Convex env vars)

export default {
  providers: [
    {
      // The issuer domain from your Clerk JWT template
      // Format: https://<frontend-api>.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      // MUST match the "aud" (audience) in the Clerk JWT template
      applicationID: "convex",
    },
  ],
};
