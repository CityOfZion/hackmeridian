declare module '*.css';

declare namespace NodeJS {
  interface ProcessEnv {
    /** bunq sandbox API key; without it the app creates its own sandbox user. Put it in `.env.local`. */
    EXPO_PUBLIC_BUNQ_API_KEY?: string;
  }
}
