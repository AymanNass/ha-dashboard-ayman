import { describe, it, expect } from 'vitest';
import type { HassEntity } from 'home-assistant-js-websocket';
import {
  deviceNameKey,
  groupMediaPlayers,
  dedupeMediaPlayers,
  collapseSpeakerGroups,
  mediaConfigFor,
  applyMediaOverride,
  artworkPickerExclusions,
} from './mediaDevices';

/** Build a minimal fake media_player entity for tests. */
function mp(
  entity_id: string,
  state = 'playing',
  attributes: Record<string, unknown> = {},
): HassEntity {
  return {
    entity_id,
    state,
    attributes: { friendly_name: entity_id, ...attributes },
    context: { id: 'x', parent_id: null, user_id: null },
    last_changed: '',
    last_updated: '',
  } as unknown as HassEntity;
}

describe('deviceNameKey', () => {
  it('collapses transport/integration variants of one device', () => {
    expect(deviceNameKey(mp('media_player.lr', 'on', { friendly_name: 'Living Room TV Cast' }))).toBe(
      deviceNameKey(mp('media_player.lr2', 'on', { friendly_name: 'Livingroom TV ADB' })),
    );
  });

  it('keeps unrelated devices distinct', () => {
    const a = deviceNameKey(mp('media_player.k', 'on', { friendly_name: 'Kitchen Speaker' }));
    const b = deviceNameKey(mp('media_player.b', 'on', { friendly_name: 'Bedroom Speaker' }));
    expect(a).not.toBe(b);
  });
});

describe('groupMediaPlayers / dedupeMediaPlayers', () => {
  it('groups duplicate entities of the same device together', () => {
    const players = [
      mp('media_player.lr_cast', 'on', { friendly_name: 'Living Room TV Cast' }),
      mp('media_player.lr_adb', 'on', { friendly_name: 'Living Room TV ADB' }),
      mp('media_player.kitchen', 'on', { friendly_name: 'Kitchen Speaker' }),
    ];
    const groups = groupMediaPlayers(players);
    expect(groups).toHaveLength(2);
    expect(dedupeMediaPlayers(players)).toHaveLength(2);
  });

  it('honours manual merges of devices the name heuristic missed', () => {
    const players = [
      mp('media_player.shield', 'on', { friendly_name: 'Office Shield' }),
      mp('media_player.beam', 'on', { friendly_name: 'Soundbar' }),
    ];
    expect(groupMediaPlayers(players)).toHaveLength(2);
    const merged = groupMediaPlayers(players, [['media_player.shield', 'media_player.beam']]);
    expect(merged).toHaveLength(1);
  });
});

describe('collapseSpeakerGroups', () => {
  it('collapses a Music Assistant sync group to just the group card (real-world Kitchen case)', () => {
    // Models the live HA data: a MA "Kitchen Group" (mass_player_type group)
    // synced with "Kitchen Speaker" (shared active_queue) plus a silent passive
    // "Kitchen Speaker 2" endpoint, alongside an independent Living Room TV.
    const livingRoom = mp('media_player.living_room_tv_cast', 'playing', {
      friendly_name: 'Living Room TV Cast',
      media_title: 'Stranded Deep',
    });
    const kitchenSpeaker = mp('media_player.kitchen_speaker_snapcast', 'playing', {
      friendly_name: 'Kitchen Speaker',
      media_title: 'progressive_di',
      app_id: 'music_assistant',
      mass_player_type: 'player',
      active_queue: 'syncgroup_h8ruj46e',
      group_members: ['media_player.kitchen_speaker_snapcast', 'media_player.satellite1'],
    });
    const kitchenSpeaker2 = mp('media_player.kitchen_kitchen_speaker_2_media_player', 'playing', {
      friendly_name: 'Kitchen Speaker 2 Media Player',
    });
    const kitchenGroup = mp('media_player.kitchen_group', 'playing', {
      friendly_name: 'Kitchen Group',
      media_title: 'progressive_di',
      app_id: 'music_assistant',
      mass_player_type: 'group',
      active_queue: 'syncgroup_h8ruj46e',
    });
    const shown = [livingRoom, kitchenSpeaker, kitchenSpeaker2, kitchenGroup];
    const devices = shown.map((e) => [e]);

    const visible = collapseSpeakerGroups(shown, devices);
    const ids = visible.map((e) => e.entity_id);
    expect(ids).toEqual(['media_player.living_room_tv_cast', 'media_player.kitchen_group']);
  });

  it('collapses a standard Cast/Sonos group_members group to its leader', () => {
    const leader = mp('media_player.cast_a', 'playing', {
      friendly_name: 'Speaker A',
      media_title: 'Song',
      group_members: ['media_player.cast_a', 'media_player.cast_b'],
    });
    const member = mp('media_player.cast_b', 'playing', {
      friendly_name: 'Speaker B',
      media_title: 'Song',
      group_members: ['media_player.cast_a', 'media_player.cast_b'],
    });
    const shown = [leader, member];
    const visible = collapseSpeakerGroups(shown, shown.map((e) => [e]));
    expect(visible.map((e) => e.entity_id)).toEqual(['media_player.cast_a']);
  });

  it('never hides a lone playing speaker', () => {
    const lone = mp('media_player.kitchen', 'playing', { friendly_name: 'Kitchen' });
    expect(collapseSpeakerGroups([lone], [[lone]])).toEqual([lone]);
  });

  it('does not hide independent speakers when no group is playing', () => {
    // A bare endpoint must only be hidden while an MA group is actually playing.
    const bare = mp('media_player.patio', 'playing', { friendly_name: 'Patio' });
    const named = mp('media_player.office', 'playing', {
      friendly_name: 'Office',
      media_title: 'Podcast',
    });
    const shown = [bare, named];
    const visible = collapseSpeakerGroups(shown, shown.map((e) => [e]));
    expect(visible).toHaveLength(2);
  });
});

describe('artworkPickerExclusions (artwork-source regression guard)', () => {
  it('does NOT exclude the device\'s own member entities', () => {
    // The companion that carries the picture is almost always a sibling on the
    // same physical device (e.g. media_player.mb_tv for media_player.mb_tv_cast).
    // Excluding members would make the correct source unpickable — the bug this
    // guards against. The artwork picker must offer every media_player.
    const deviceMembers = ['media_player.mb_tv', 'media_player.mb_tv_cast', 'media_player.mb_tv_remote'];
    const excluded = artworkPickerExclusions(deviceMembers);
    expect(excluded.size).toBe(0);
    for (const id of deviceMembers) {
      expect(excluded.has(id)).toBe(false);
    }
  });
});

describe('mediaConfigFor', () => {
  it('returns empty config (page defaults) when no member has an override', () => {
    expect(mediaConfigFor(['media_player.x', 'media_player.x_cast'], {})).toEqual({});
  });

  it('merges overrides across all member entity_ids', () => {
    const overrides = {
      'media_player.x': { mediaArtwork: false as const },
      'media_player.x_cast': { artworkEntity: 'media_player.y' },
    };
    expect(mediaConfigFor(['media_player.x', 'media_player.x_cast'], overrides)).toEqual({
      mediaArtwork: false,
      artworkEntity: 'media_player.y',
    });
  });
});

describe('applyMediaOverride (artwork-config regression guard)', () => {
  const ids = ['media_player.x', 'media_player.x_cast'];

  it('stores an artwork source on every member entity of the device', () => {
    const result = applyMediaOverride({}, ids, { artworkEntity: 'media_player.y' });
    expect(result).toEqual({
      'media_player.x': { artworkEntity: 'media_player.y' },
      'media_player.x_cast': { artworkEntity: 'media_player.y' },
    });
    // Reading it back yields the same effective config.
    expect(mediaConfigFor(ids, result)).toEqual({ artworkEntity: 'media_player.y' });
  });

  it('stores the non-default mediaArtwork: false', () => {
    const result = applyMediaOverride({}, ids, { mediaArtwork: false });
    expect(result['media_player.x']).toEqual({ mediaArtwork: false });
  });

  it('prunes back to empty when artwork is re-enabled (no stale entries)', () => {
    const disabled = applyMediaOverride({}, ids, { mediaArtwork: false });
    // The settings toggle re-enables by passing mediaArtwork: undefined.
    const reEnabled = applyMediaOverride(disabled, ids, { mediaArtwork: undefined });
    expect(reEnabled).toEqual({});
  });

  it('drops an empty (Auto) artwork source instead of persisting it', () => {
    const withSource = applyMediaOverride({}, ids, { artworkEntity: 'media_player.y' });
    const cleared = applyMediaOverride(withSource, ids, { artworkEntity: undefined });
    expect(cleared).toEqual({});
  });

  it('keeps other settings when one is cleared', () => {
    let o = applyMediaOverride({}, ids, { mediaArtwork: false });
    o = applyMediaOverride(o, ids, { artworkEntity: 'media_player.y' });
    o = applyMediaOverride(o, ids, { artworkEntity: undefined });
    expect(o['media_player.x']).toEqual({ mediaArtwork: false });
  });

  it('does not mutate the input overrides map', () => {
    const input = Object.freeze({ 'media_player.x': Object.freeze({ mediaArtwork: false as const }) });
    expect(() => applyMediaOverride(input as Record<string, { mediaArtwork?: boolean }>, ids, { artworkEntity: 'media_player.y' })).not.toThrow();
    expect(input).toEqual({ 'media_player.x': { mediaArtwork: false } });
  });
});
