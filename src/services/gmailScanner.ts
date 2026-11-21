import { GmailDetectedItem } from '../types/finance';

export interface RawGmailMessageExcerpt {
  messageId: string;
  subject: string;
  from: string;
  dateISO: string;
  snippet: string;
  bodyText: string;
}

const GMAIL_FINANCIAL_QUERY =
  '(EMI OR installment OR "loan payment" OR "payment due" OR "payment received" OR debited OR "spent on" OR "auto-debit" OR UPI OR SIP OR "mutual fund" OR "bill payment" OR invoice OR statement)';

function decodeBase64Url(input: string): string {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function extractBodyText(payload?: GmailPart): string {
  if (!payload) return '';
  const collect = (part: GmailPart, targetMime: string): string | null => {
    if (part.mimeType === targetMime && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        const found = collect(child, targetMime);
        if (found) return found;
      }
    }
    return null;
  };

  const plain = collect(payload, 'text/plain');
  if (plain) return plain.replace(/\s+/g, ' ').trim().slice(0, 1200);

  const html = collect(payload, 'text/html');
  if (html) return stripHtmlTags(html).slice(0, 1200);

  if (payload.body?.data) {
    return stripHtmlTags(decodeBase64Url(payload.body.data)).slice(0, 1200);
  }
  return '';
}

function toISODate(dateHeader?: string, internalDateMs?: string): string {
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  if (internalDateMs && /^\d+$/.test(internalDateMs)) {
    const parsed = new Date(Number(internalDateMs));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export async function fetchFinancialGmailMessages(
  gmailAccessToken: string,
  maxResults = 18
): Promise<{ emailAddress: string; messages: RawGmailMessageExcerpt[] }> {
  const headers = {
    Authorization: `Bearer ${gmailAccessToken}`,
  };

  const [profileRes, listRes] = await Promise.all([
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers }),
    fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(GMAIL_FINANCIAL_QUERY)}&maxResults=${maxResults}`,
      { headers }
    ),
  ]);

  if (profileRes.status === 401 || listRes.status === 401) {
    throw new Error('GMAIL_TOKEN_EXPIRED');
  }
  if (!listRes.ok) {
    const errJson = await listRes.json().catch(() => ({}));
    throw new Error(
      errJson?.error?.message || `Unable to read Gmail inbox (${listRes.status}).`
    );
  }

  const profileJson = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};
  const listJson = await listRes.json().catch(() => ({}));
  const emailAddress =
    typeof profileJson?.emailAddress === 'string' ? profileJson.emailAddress : '';
  const messageRefs: Array<{ id: string }> = Array.isArray(listJson?.messages)
    ? listJson.messages
    : [];

  if (messageRefs.length === 0) {
    return { emailAddress, messages: [] };
  }

  const results: RawGmailMessageExcerpt[] = [];
  const batchSize = 5;
  for (let i = 0; i < messageRefs.length; i += batchSize) {
    const chunk = messageRefs.slice(i, i + batchSize);
    const settled = await Promise.all(
      chunk.map(async (ref) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
          { headers }
        );
        if (!res.ok) return null;
        const msg = await res.json();
        const msgHeaders: Array<{ name?: string; value?: string }> =
          msg?.payload?.headers ?? [];
        const getHeader = (name: string) =>
          msgHeaders.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

        return {
          messageId: String(msg.id ?? ref.id),
          subject: getHeader('Subject').slice(0, 180) || '(No Subject)',
          from: getHeader('From').slice(0, 140) || 'Unknown sender',
          dateISO: toISODate(getHeader('Date'), msg.internalDate),
          snippet: String(msg.snippet ?? '').slice(0, 300),
          bodyText: extractBodyText(msg.payload),
        } satisfies RawGmailMessageExcerpt;
      })
    );
    for (const item of settled) {
      if (item) results.push(item);
    }
  }

  return { emailAddress, messages: results };
}

export async function analyzeGmailMessagesViaServer(
  elevateToken: string,
  messages: RawGmailMessageExcerpt[]
): Promise<{ items: GmailDetectedItem[]; analyzerMode: 'gemini' | 'deterministic' }> {
  const res = await fetch('/api/gmail/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${elevateToken}`,
    },
    body: JSON.stringify({ emails: messages }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not analyze financial emails.');
  }
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    analyzerMode: data?.analyzerMode === 'gemini' ? 'gemini' : 'deterministic',
  };
}
