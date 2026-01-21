import { next } from '@vercel/edge';

export const config = {
  matcher: '/:path*',
};

export default function middleware(req) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // 'admin' é o usuário padrão do pop-up
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
