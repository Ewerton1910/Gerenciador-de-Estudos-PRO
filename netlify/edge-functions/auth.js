export default async (request, context) => {
  const auth = request.headers.get("authorization");

  // Pega a senha das variáveis de ambiente do Netlify
  const SENHA_CORRETA = Netlify.env.get("SITE_PASSWORD") || "1234";

  if (auth) {
    const [_scheme, encoded] = auth.split(" ");
    const decoded = atob(encoded);
    const [user, pwd] = decoded.split(":");

    if (user === "admin" && pwd === SENHA_CORRETA) {
      return; // Permite o acesso
    }
  }

  return new Response("Acesso Restrito", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Acesso Seguro"',
    },
  });
};
