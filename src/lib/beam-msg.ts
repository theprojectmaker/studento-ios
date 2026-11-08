/**
 * Rich Beam messages. Everything rides inside the plain `body` string of a normal message, so
 * the backend never needs new routes: a body that starts with RICH is JSON. Votes, reactions,
 * edits, unsends and "opened" receipts are their own small messages that point at another
 * message id; fold() replays them onto the messages they target.
 */
export const RICH = '⁣B1';

export type Rich =
  | { k: 'txt'; t: string; r?: number }
  | { k: 'img'; d: string[]; c?: string; once?: boolean; r?: number }
  | { k: 'vid'; u: string; p?: string; s?: number; c?: string; r?: number }
  | { k: 'poll'; q: string; o: string[]; multi?: boolean }
  | { k: 'cd'; t: string; at: number }
  | { k: 'stk'; e: string }
  | { k: 'chess'; g: string }
  // events
  | { k: 'vote'; m: number; o: number[] }
  | { k: 're'; m: number; e: string }
  | { k: 'del'; m: number }
  | { k: 'edit'; m: number; t: string }
  | { k: 'seen'; m: number };

/** Longest body Firestore keeps for a message (a document holds up to 1 MB). */
export const MAX_BODY = 900_000;

export const encode = (r: Rich) => RICH + JSON.stringify(r);

export function decode(body: string): Rich {
  if (body.startsWith(RICH)) {
    try {
      return JSON.parse(body.slice(RICH.length)) as Rich;
    } catch {}
  }
  return { k: 'txt', t: body };
}

const EVENTS = new Set(['vote', 're', 'del', 'edit', 'seen']);
export const isEvent = (r: Rich) => EVENTS.has(r.k);

/** Short text for the conversation list and notifications. */
export function preview(body: string): string {
  const r = decode(body);
  switch (r.k) {
    case 'txt':
      return r.t;
    case 'img':
      return r.once ? 'Sent a one-time photo' : r.d.length > 1 ? `${r.d.length} photos` : r.c ? `Photo: ${r.c}` : 'Photo';
    case 'vid':
      return r.c ? `Video: ${r.c}` : 'Video';
    case 'poll':
      return `Poll: ${r.q}`;
    case 'cd':
      return `Countdown: ${r.t}`;
    case 'chess':
      return 'Chess game';
    case 'stk':
      return r.e;
    case 'vote':
      return 'Voted in a poll';
    case 're':
      return `Reacted ${r.e}`;
    case 'del':
      return 'Unsent a message';
    case 'edit':
      return `Edited: ${r.t}`;
    case 'seen':
      return 'Opened a photo';
  }
}

export interface Folded {
  id: number;
  mine: boolean;
  createdAt: number;
  rich: Rich;
  deleted: boolean;
  edited: boolean;
  seen: boolean;
  /** emoji -> who (mine / theirs) */
  reactions: { e: string; mine: boolean }[];
  /** poll option index -> [my vote, their vote] */
  votes: { mine: number[]; theirs: number[] };
}

/** Turn the raw message list into display messages with every event applied. */
export function fold(msgs: { id: number; mine: boolean; body: string; createdAt: number }[]): Folded[] {
  const out: Folded[] = [];
  const byId = new Map<number, Folded>();
  for (const m of msgs) {
    const rich = decode(m.body);
    if (!isEvent(rich)) {
      const f: Folded = { id: m.id, mine: m.mine, createdAt: m.createdAt, rich, deleted: false, edited: false, seen: false, reactions: [], votes: { mine: [], theirs: [] } };
      out.push(f);
      byId.set(m.id, f);
      continue;
    }
    const t = byId.get((rich as { m: number }).m);
    if (!t) continue;
    if (rich.k === 'del' && t.mine === m.mine) t.deleted = true;
    else if (rich.k === 'edit' && t.mine === m.mine && t.rich.k === 'txt') {
      t.rich = { ...t.rich, t: rich.t };
      t.edited = true;
    } else if (rich.k === 'seen' && t.mine !== m.mine) t.seen = true;
    else if (rich.k === 're') {
      t.reactions = t.reactions.filter((x) => x.mine !== m.mine);
      if (rich.e) t.reactions.push({ e: rich.e, mine: m.mine });
    } else if (rich.k === 'vote') {
      if (m.mine) t.votes.mine = rich.o;
      else t.votes.theirs = rich.o;
    }
  }
  return out;
}

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
export const STICKERS = ['😀', '😂', '🥹', '😍', '😎', '🤯', '🥳', '😭', '😡', '👀', '💀', '🙏', '👍', '👏', '🔥', '💯', '🎉', '❤️', '💔', '✨', '🤝', '🫡', '🤔', '😴'];
