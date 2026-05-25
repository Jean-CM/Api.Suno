import pino from "pino";
import { NextRequest, NextResponse } from "next/server";
import { Page } from "rebrowser-playwright-core";

const logger = pino();

/**
 * Pause for a specified number of seconds.
 * @param x Minimum number of seconds.
 * @param y Maximum number of seconds (optional).
 */
export const sleep = (x: number, y?: number): Promise<void> => {
  let timeout = x * 1000;
  if (y !== undefined && y !== x) {
    const min = Math.min(x, y);
    const max = Math.max(x, y);
    timeout = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  }
  logger.info(`Sleeping for ${timeout / 1000} seconds`);

  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * @param target A Locator or a page
 * @returns {boolean}
 */
export const isPage = (target: any): target is Page => {
  return target.constructor.name === 'Page';
}

/**
 * Waits for an hCaptcha image requests and then waits for all of them to end
 * @param page
 * @param signal `const controller = new AbortController(); controller.status`
 * @returns {Promise<void>}
 */
export const waitForRequests = (page: Page, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    const urlPattern = /^https:\/\/img[a-zA-Z0-9]*\.hcaptcha\.com\/.*$/;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let activeRequestCount = 0;
    let requestOccurred = false;

    const cleanupListeners = () => {
      page.off('request', onRequest);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFinished);
    };

    const resetTimeout = () => {
      if (timeoutHandle)
        clearTimeout(timeoutHandle);
      if (activeRequestCount === 0) {
        timeoutHandle = setTimeout(() => {
          cleanupListeners();
          resolve();
        }, 1000);
      }
    };

    const onRequest = (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        requestOccurred = true;
        activeRequestCount++;
        if (timeoutHandle)
          clearTimeout(timeoutHandle);
      }
    };

    const onRequestFinished = (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        activeRequestCount--;
        resetTimeout();
      }
    };

    const initialTimeout = setTimeout(() => {
      if (!requestOccurred) {
        page.off('request', onRequest);
        cleanupListeners();
        reject(new Error('No hCaptcha request occurred within 1 minute.'));
      } else {
        resetTimeout();
      }
    }, 60000);

    page.on('request', onRequest);
    page.on('requestfinished', onRequestFinished);
    page.on('requestfailed', onRequestFinished);

    page.on('request', (request: { url: () => string }) => {
      if (urlPattern.test(request.url())) {
        clearTimeout(initialTimeout);
      }
    });

    const onAbort = () => {
      cleanupListeners();
      clearTimeout(initialTimeout);
      if (timeoutHandle)
        clearTimeout(timeoutHandle);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

export const getCorsHeaders = (req?: Request | NextRequest) => {
  const origins = allowedOrigins();
  const requestOrigin = req?.headers.get('origin') || '';
  const allowAll = origins.includes('*');
  const originAllowed = allowAll || origins.includes(requestOrigin);

  return {
    'Access-Control-Allow-Origin': allowAll ? '*' : (originAllowed ? requestOrigin : origins[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };
};

export const corsHeaders = getCorsHeaders();

export const unauthorizedResponse = (req?: Request | NextRequest) => {
  return NextResponse.json(
    {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid API key.'
    },
    {
      status: 401,
      headers: getCorsHeaders(req)
    }
  );
};

export const requireApiKey = (req: NextRequest): NextResponse | null => {
  const configuredKey = process.env.JATUNE_API_KEY;

  // Backward compatible: if no key is configured, keep the API open.
  // For production, always set JATUNE_API_KEY in Render.
  if (!configuredKey) {
    return null;
  }

  const providedKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (providedKey !== configuredKey) {
    return unauthorizedResponse(req);
  }

  return null;
};
