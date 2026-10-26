declare module '*.css';

declare namespace NodeJS {
  interface ProcessEnv {
    /** bunq production API key (required). Put it in `.env.local`. */
    EXPO_PUBLIC_BUNQ_API_KEY?: string;
  }
}
