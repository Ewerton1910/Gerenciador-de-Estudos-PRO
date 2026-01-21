import { NextResponse } from 'next/server';

export default function middleware(req) {
  const url = req.nextUrl;
  const authCookie = req.cookies.get('auth');

  // Se já tiver o cookie, libera
  if (authCookie && authCookie.value === 'true') {
    return NextResponse.next();
  }

  // Pega a senha da URL (?pw=...)
  const passwordInput = url.searchParams.get('pw');
  const passwordCorreta = process.env.SITE_PASSWORD; // Puxa da imagem que você mandou

  if (passwordInput === passwordCorreta) {
    const response = NextResponse.next();
    response.cookies.set('auth', 'true', { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
    return response;
  }

  // Se não tiver senha ou estiver errada, bloqueia tudo
  return new Response('🔒 Acesso Restrito. Use a URL com ?pw=SuaSenha', { 
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
