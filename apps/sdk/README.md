# SDK Mobile App

The SDK project is an Expo-managed React Native application used as the reference implementation for POS partner integrations. It will showcase how to embed the immigration onboarding experiences into third-party point-of-sale systems.

## Planned responsibilities
- Demonstrate authentication and deep-linking flows for partner POS systems.
- Provide reusable mobile UI components that integrate with the shared UI package.
- Offer example screens that consume the shared API client for end-to-end testing.
- Serve as a sandbox for testing native capabilities needed by partner implementations.

## Local development

1. Copy `.env.example` to `.env` and update the LAN IP and Supabase credentials for your environment.
2. Install dependencies with `pnpm install --filter @codex/sdk`.
3. Start the Expo dev server with tunnel mode so physical devices can connect:

   ```bash
   npx expo start --tunnel
   ```

The tunnel connection ensures mobile devices running Expo Go can reach the local API and Supabase backends.
