import { next } from '@vercel/edge';

export default function middleware(req) {
  const authCookie = req.cookies.get('auth');
  const url = new URL(req.url);

  // 1. Se já existir o cookie de autorização, permite o acesso
  if (authCookie === 'true') {
    return next();
  }

  // 2. Tenta pegar a senha da URL (ex: seu-site.vercel.app/?pw=SUASENHA)
  const passwordInput = url.searchParams.get('pw');
  
  // 3. Compara com a variável de ambiente definida na Vercel
  // Caso você ainda não tenha configurado na Vercel, o padrão será '1234'
  const passwordCorreta = process.env.SITE_PASSWORD || '1234';

  if (passwordInput === passwordCorreta) {
    const response = next();
    // Cria um cookie que expira em 30 dias para você não ter que digitar sempre
    response.cookies.set('auth', 'true', { 
      path: '/', 
      httpOnly: true, 
      maxAge: 60 * 60 * 24 * 30 
    });
    return response;
  }

  // 4. Se não houver senha ou estiver errada, bloqueia o acesso
  return new Response('🔒 Acesso Restrito. Adicione ?pw=SUASENHA ao final da URL.', { 
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

export const config = {
  matcher: '/:path*',
};
