import { NextResponse, NextRequest } from "next/server";
import { cookies } from 'next/headers'
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { getCorsHeaders, requireApiKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { prompt, make_instrumental, model, wait_audio } = body;

      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json(
          { ok: false, code: 'INVALID_PROMPT', message: 'Prompt is required.' },
          { status: 400, headers: getCorsHeaders(req) }
        );
      }

      const audioInfo = await (await sunoApi((await cookies()).toString())).generate(
        prompt,
        Boolean(make_instrumental),
        model || DEFAULT_MODEL,
        Boolean(wait_audio)
      );

      return new NextResponse(JSON.stringify(audioInfo), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req)
        }
      });
    } catch (error: any) {
      console.error('Error generating audio:', error);

      if (error.response) {
        console.error('Response error:', JSON.stringify(error.response.data));

        if (error.response.status === 402) {
          return new NextResponse(JSON.stringify({
            ok: false,
            code: 'SUNO_PAYMENT_REQUIRED',
            error: error.response.data?.detail || 'Payment required'
          }), {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(req)
            }
          });
        }

        return new NextResponse(JSON.stringify({
          ok: false,
          code: 'SUNO_API_ERROR',
          error: 'API Error: ' + (error.response.data?.detail || error.response.statusText || 'Unknown error')
        }), {
          status: error.response.status || 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(req)
          }
        });
      } else if (error.request) {
        console.error('Network error:', error.message);
        return new NextResponse(JSON.stringify({
          ok: false,
          code: 'SUNO_NETWORK_ERROR',
          error: 'Network error: Unable to connect to Suno API. Please check your internet connection and try again.'
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(req)
          }
        });
      } else {
        console.error('Other error:', error.message);
        return new NextResponse(JSON.stringify({
          ok: false,
          code: 'INTERNAL_ERROR',
          error: 'Internal error: ' + (error.message || 'Unknown error occurred')
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(req)
          }
        });
      }
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'POST',
        ...getCorsHeaders(req)
      },
      status: 405
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request)
  });
}
