import { NextResponse } from 'next/server';

export default function middleware(req) {
  const authCookie = req.cookies.get('auth');
  const url = req.nextUrl;

  // 1. Se já tiver o cookie, libera o acesso
  if (authCookie && (authCookie.value === 'true' || authCookie === 'true')) {
    return NextResponse.next();
  }

  // 2. Pega a senha da URL
  const passwordInput = url.searchParams.get('pw');
  const passwordCorreta = process.env.SITE_PASSWORD || "1234";

  if (passwordInput === passwordCorreta) {
    const response = NextResponse.next();
    response.cookies.set('auth', 'true', { 
      path: '/', 
      httpOnly: true, 
      maxAge: 60 * 60 * 24 * 30 
    });
    return response;
  }

  // 3. Bloqueia se não tiver a senha
  return new Response('🔒 Acesso Restrito. Adicione ?pw=SUASENHA na URL.', {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
