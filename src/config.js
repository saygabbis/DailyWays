// Versão da app: campo "version" em package.json (exibida em Configurações > Aplicativo).
// Semver (a partir de 2.0.x): 2.0.x = patches; 2.x.0 = médio; x.0.0 = grande estrutura (+1 no segmento certo).
// Para o login Microsoft funcionar: configure no Supabase (Auth > Providers > Azure)
// o Redirect URI, Application (client) ID e Client secret do app Azure AD.
export const ENABLE_MICROSOFT_LOGIN = true;
