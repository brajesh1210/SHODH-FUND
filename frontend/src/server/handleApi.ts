import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SESSION_COOKIE = "sf_session";
const SESSION_SECONDS = 8 * 60 * 60;

function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function handleApi(req: NextRequest, parts: string[]) {
  const path = parts.join("/");

  if (req.method === "POST" && path === "auth/logout") {
    return clearSession(NextResponse.json({ ok: true }));
  }

  const sourceUrl = new URL(req.url);
  const target = `${API}/api/${path}${sourceUrl.search}`;
  const headers = new Headers();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const directAuthorization = req.headers.get("authorization");
  if (token) headers.set("authorization", `Bearer ${token}`);
  else if (directAuthorization) headers.set("authorization", directAuthorization);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const incoming = await req.arrayBuffer();
    if (incoming.byteLength) body = incoming;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (path === "auth/login" && req.method === "POST" && upstream.ok) {
      const payload = (await upstream.json()) as {
        token?: string;
        user?: unknown;
      };
      if (!payload.token || !payload.user) {
        return NextResponse.json(
          { error: "The authentication service returned an incomplete session." },
          { status: 502 }
        );
      }
      const response = NextResponse.json({ user: payload.user });
      response.cookies.set(SESSION_COOKIE, payload.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return response;
    }

    const data = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (
        ![
          "transfer-encoding",
          "content-encoding",
          "content-length",
          "set-cookie",
        ].includes(key.toLowerCase())
      ) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("Cache-Control", "private, no-store");
    const response = new NextResponse(data, {
      status: upstream.status,
      headers: responseHeaders,
    });

    if (upstream.status === 401 && path !== "auth/login") {
      clearSession(response);
    }
    return response;
  } catch (error: unknown) {
    console.error(
      "Backend proxy request failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "The application service is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
