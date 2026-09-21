import { describe, expect, it } from 'vitest';
import type { ApplyCallKind } from '@bombfarm/contracts';
import type { RequestOutcome } from '@bombfarm/game-api';
import { classifyApplyOutcome, type ApplyCallVerdict } from './apply-outcome.js';

type Case = [string, RequestOutcome, ApplyCallKind, ApplyCallVerdict];

const CASES: Case[] = [
  ['a success settles the call', { kind: 'ok', status: 200, json: {} }, 'equip', { kind: 'ok' }],
  [
    'HERO_LEVEL_TOO_LOW skips heroLevel, carrying its code',
    { kind: 'api_error', status: 409, code: 'HERO_LEVEL_TOO_LOW' },
    'equip',
    { kind: 'skip', reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' },
  ],
  [
    'NOT_ENOUGH_GOLD skips notEnoughGold, carrying its code',
    { kind: 'api_error', status: 409, code: 'NOT_ENOUGH_GOLD' },
    'respec',
    { kind: 'skip', reason: 'notEnoughGold', code: 'NOT_ENOUGH_GOLD' },
  ],
  [
    'NO_SUCH_HERO skips heroMissing, carrying its code',
    { kind: 'api_error', status: 409, code: 'NO_SUCH_HERO' },
    'commit',
    { kind: 'skip', reason: 'heroMissing', code: 'NO_SUCH_HERO' },
  ],
  [
    'NO_SUCH_ITEM skips itemMissing, carrying its code',
    { kind: 'api_error', status: 409, code: 'NO_SUCH_ITEM' },
    'equip',
    { kind: 'skip', reason: 'itemMissing', code: 'NO_SUCH_ITEM' },
  ],
  [
    'ALREADY_EQUIPPED skips itemMoved, carrying its code',
    { kind: 'api_error', status: 409, code: 'ALREADY_EQUIPPED' },
    'equip',
    { kind: 'skip', reason: 'itemMoved', code: 'ALREADY_EQUIPPED' },
  ],
  [
    'a named refusal the app does not recognize stops refused, carrying its code (SERVER_LOCKED)',
    { kind: 'api_error', status: 409, code: 'SERVER_LOCKED' },
    'equip',
    { kind: 'stop', stop: 'refused', code: 'SERVER_LOCKED' },
  ],
  [
    'a named refusal the app does not recognize stops refused, carrying its code (BAD_ALLOC)',
    { kind: 'api_error', status: 409, code: 'BAD_ALLOC' },
    'commit',
    { kind: 'stop', stop: 'refused', code: 'BAD_ALLOC' },
  ],
  [
    'an invented api_error code stops refused, carrying it verbatim',
    { kind: 'api_error', status: 200, code: 'MADE_UP_CODE' },
    'respec',
    { kind: 'stop', stop: 'refused', code: 'MADE_UP_CODE' },
  ],
  [
    'a code-less 404 on equip skips itemMissing',
    { kind: 'http_error', status: 404, preview: '' },
    'equip',
    { kind: 'skip', reason: 'itemMissing' },
  ],
  [
    'a code-less 404 on unequip skips itemMissing',
    { kind: 'http_error', status: 404, preview: '' },
    'unequip',
    { kind: 'skip', reason: 'itemMissing' },
  ],
  [
    'a code-less 404 on respec skips heroMissing',
    { kind: 'http_error', status: 404, preview: '' },
    'respec',
    { kind: 'skip', reason: 'heroMissing' },
  ],
  [
    'a code-less 404 on commit skips heroMissing',
    { kind: 'http_error', status: 404, preview: '' },
    'commit',
    { kind: 'skip', reason: 'heroMissing' },
  ],
  [
    'a code-less 400 stops refused with a synthesised HTTP_<status> code',
    { kind: 'http_error', status: 400, preview: '' },
    'equip',
    { kind: 'stop', stop: 'refused', code: 'HTTP_400' },
  ],
  [
    'a code-less 422 stops refused with a synthesised HTTP_<status> code',
    { kind: 'http_error', status: 422, preview: '' },
    'commit',
    { kind: 'stop', stop: 'refused', code: 'HTTP_422' },
  ],
  [
    'a 5xx http_error stops network',
    { kind: 'http_error', status: 500, preview: '' },
    'equip',
    { kind: 'stop', stop: 'network', code: null },
  ],
  ['cooldown pauses (no code)', { kind: 'cooldown', status: 429, retryHint: null }, 'equip', { kind: 'cooldown' }],
  [
    'unauthorized stops unauthorized',
    { kind: 'unauthorized', status: 401, code: null },
    'equip',
    { kind: 'stop', stop: 'unauthorized', code: null },
  ],
  [
    'a transport failure stops network',
    { kind: 'transport_error', message: 'boom' },
    'equip',
    { kind: 'stop', stop: 'network', code: null },
  ],
  [
    'unreadable JSON on a 200 stops network',
    { kind: 'malformed_json', preview: '' },
    'equip',
    { kind: 'stop', stop: 'network', code: null },
  ],
  [
    'an oversized response stops network',
    { kind: 'too_large', bytes: 3_000_000 },
    'equip',
    { kind: 'stop', stop: 'network', code: null },
  ],
];

describe('classifyApplyOutcome', () => {
  it.each(CASES)('%s', (_description, outcome, call, expected) => {
    expect(classifyApplyOutcome(outcome, call)).toEqual(expected);
  });
});
