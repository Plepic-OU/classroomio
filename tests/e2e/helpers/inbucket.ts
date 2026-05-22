// Despite the name, supabase-cli ships Mailpit (public.ecr.aws/supabase/mailpit) at port 54324.
// Mailpit's REST API is different from Inbucket's: it uses /api/v1/messages (list) and
// /api/v1/message/<id> (detail), and accepts a `query` param like `to:user@example.com`.
const MAILPIT_BASE = 'http://localhost:54324';

export interface InbucketMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
}

interface MailpitListItem {
  ID: string;
  From: { Address: string; Name?: string };
  Subject: string;
}

interface MailpitMessageDetail {
  Text: string;
  HTML: string;
}

export async function waitForEmail(
  localpart: string,
  opts?: { subject?: RegExp; timeout?: number }
): Promise<InbucketMessage> {
  const timeout = opts?.timeout ?? 15_000;
  const interval = 500;
  const deadline = Date.now() + timeout;
  const query = encodeURIComponent(`to:${localpart}@`);

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_BASE}/api/v1/search?query=${query}&limit=50`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: MailpitListItem[] };
      const match = messages.find((m) => !opts?.subject || opts.subject.test(m.Subject));
      if (match) {
        const detailRes = await fetch(`${MAILPIT_BASE}/api/v1/message/${match.ID}`);
        const detail = (await detailRes.json()) as MailpitMessageDetail;
        return {
          id: match.ID,
          from: match.From.Address,
          subject: match.Subject,
          body: detail.Text || detail.HTML || '',
        };
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`No email matching "${localpart}" (subject: ${opts?.subject}) within ${timeout}ms`);
}

export function extractLink(body: string, hrefMatch: RegExp): string {
  const m = body.match(hrefMatch);
  if (!m) throw new Error(`No link matching ${hrefMatch} in email body`);
  return m[0];
}
