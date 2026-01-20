import { next } from '@vercel/edge';

export const config = {
  // Isso garante que o middleware rode em todas as páginas
  matcher: '/:path*',
};

export default function middleware(req) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    // Decodifica o login (admin:suasenha)
    const [user, pwd] = atob(authValue).split(':');

    // Compara com a variável que você salvou na Vercel
    if (user === 'admin' && pwd === process.env.SITE_PASSWORD) {
      return next();
    }
  }

  return new Response('Acesso Restrito', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Acesso Protegido"',
      'Content-Type': 'text/html; charset=utf-8'
    },
  });
}
