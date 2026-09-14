export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Tablet/i.test(ua);
    const forceDesktop = url.searchParams.get('desktop') === '1';
    const forceMobile = url.searchParams.get('mobile') === '1';
    const isHome = url.pathname === '/' || url.pathname === '/index.html';

    if (isHome && !forceDesktop && (isMobile || forceMobile)) {
      const target = new URL('/mobile-v2.html', url.origin);
      for (const [key, value] of url.searchParams) {
        if (key !== 'mobile') target.searchParams.set(key, value);
      }
      return Response.redirect(target.toString(), 302);
    }

    return env.ASSETS.fetch(request);
  }
};