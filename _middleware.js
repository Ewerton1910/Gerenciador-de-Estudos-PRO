import { next } from '@vercel/edge';

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};

export default function middleware(req) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    // Decodifica o Usuário e Senha enviados pelo navegador
    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    const usuarioCorreto = 'admin'; // Você pode mudar o nome de usuário aqui
    const senhaCorreta = process.env.SITE_PASSWORD || '1234';

    if (user === usuarioCorreto && pwd === senhaCorreta) {
      return next();
    }
  }

  // Se não estiver logado, envia o comando para o navegador abrir o pop-up
  return new Response('Acesso Restrito', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Acesso Protegido"',
    },
  });
}
