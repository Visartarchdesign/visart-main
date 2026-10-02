// /ru/ — bosh sahifaning ruscha versiyasi. Admin sozlamalari (_middleware.js) keyin qo'llanadi.
import { toRussianHome } from '../_lib/ruHome.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname === '/ru') return Response.redirect(`${url.origin}/ru/${url.search}`, 301);
  const home = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers }));
  if (!home.ok) return home;
  return toRussianHome(home);
}
