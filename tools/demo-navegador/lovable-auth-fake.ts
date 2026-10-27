// Login social de demonstração: entra direto, sem sair da página.
export type OAuthProvider = 'google' | 'lovable' | 'apple';
export function createLovableAuth() {
  return { signInWithOAuth: async () => ({ redirected: false, error: null, tokens: { access_token: 'demo.preview.token', refresh_token: 'r' } }) };
}
