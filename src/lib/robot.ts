import type { HassEntities } from 'home-assistant-js-websocket';

type CallHA = (
  domain: string,
  service: string,
  data?: Record<string, unknown>,
  target?: { entity_id: string | string[] },
) => Promise<void>;

/** Roborock vacuum + its Shelly power plug. */
export const VACUUM_ENTITY = 'vacuum.roborock_qv_35a';
export const ROBOT_PLUG_ENTITY = 'switch.shellyplugmg3_907069554a80';

/**
 * The robot is normally kept powered off at the wall (Shelly plug) for fire
 * safety, and only powered when in use. So before sending any "start cleaning"
 * command from the dashboard we must make sure the plug is ON — otherwise the
 * robot has no power and the command does nothing.
 *
 * If the plug is already on, send `start` immediately (no delay). If it's off
 * (or we don't yet know its state), turn it on, wait a moment for the robot to
 * boot and reconnect, then send `start`.
 *
 * Pass the specific start call as `startFn` so this works for both "clean all"
 * (vacuum.start) and "clean selected rooms" (vacuum.send_command).
 */
export async function ensurePowerThenStart(
  callHA: CallHA,
  entities: HassEntities,
  startFn: () => void | Promise<void>,
  bootWaitMs = 8000,
): Promise<void> {
  const plugOn = entities[ROBOT_PLUG_ENTITY]?.state === 'on';
  if (plugOn) {
    await startFn();
    return;
  }
  // Plug is off (or unknown) → power it, wait for the robot to come online.
  await callHA('switch', 'turn_on', undefined, { entity_id: ROBOT_PLUG_ENTITY });
  await new Promise((r) => setTimeout(r, bootWaitMs));
  await startFn();
}
