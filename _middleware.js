import { NextResponse } from 'next/server';

export default function middleware(req) {
  const url = req.nextUrl;
  const authCookie = req.cookies.get('auth');

  // 1. Se já existir o cookie de autorização, permite o acesso
  if (authCookie && authCookie.value === 'true') {
    return NextResponse.next();
  }

  // 2. Tenta pegar a senha da URL
  const passwordInput = url.searchParams.get('pw');
  const passwordCorreta = process.env.SITE_PASSWORD || '1234';

  if (passwordInput === passwordCorreta) {
    const response = NextResponse.next();
    // Cria um cookie que expira em 30 dias
    response.cookies.set('auth', 'true', { 
      path: '/', 
      httpOnly: true, 
      maxAge: 60 * 60 * 24 * 30 
    });
    return response;
  }

  // 3. Se não houver senha ou estiver errada, bloqueia o acesso
  return new Response('🔒 Acesso Restrito. Adicione ?pw=SUASENHA ao final da URL.', { 
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
