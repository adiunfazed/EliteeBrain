import { getIdToken } from './firebase';

/**
 * A fetch that carries the user's token and retries once on rejection.
 *
 * Two things went wrong before this existed. Every caller forced a token
 * refresh, which hits Firebase's rate limit and then returns nothing — so a
 * signed-in user started seeing "sign in first". And when a token genuinely
 * had expired, nothing retried, so the failure was permanent until reload.
 *
 * The normal path uses the cached token and costs no network; a forced
 * refresh happens only after the server has actually rejected one.
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const send = async (token: string | null) =>
    fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let response = await send(await getIdToken());

  // 401 means the token was rejected. That is the one case where forcing a
  // refresh is correct, and retrying once resolves an expired token without
  // the user noticing.
  if (response.status === 401) {
    const fresh = await getIdToken(true);
    if (fresh) response = await send(fresh);
  }

  return response;
}
