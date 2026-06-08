import { useEffect, useState } from 'react';
import { cameras } from '../config';
import { HA_URL } from '../config';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';

interface Props {
  entities: HassEntities;
}

/** Choose a column count so a handful of cameras grow to fill the space,
 *  and more cameras shrink into a tighter grid. */
function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 3;
  return 4;
}

/** Build a camera image URL, preferring HA's signed `entity_picture` (the
 *  always-valid path) over the raw `access_token`, which HA rotates every few
 *  minutes — a stale one yields a 401 that HA logs as "invalid authentication".
 *  An optional cache-buster keeps the open popup feeling live. */
function camSrc(entity: HassEntity, entityId: string, bust?: number): string {
  const pic = entity.attributes.entity_picture as string | undefined;
  let base = pic ? (pic.startsWith('http') ? pic : `${HA_URL}${pic}`) : '';
  if (!base) {
    const token = entity.attributes.access_token as string | undefined;
    base = token ? `${HA_URL}/api/camera_proxy/${entityId}?token=${token}` : '';
  }
  if (!base) return '';
  return bust ? `${base}${base.includes('?') ? '&' : '?'}_t=${bust}` : base;
}

export function CameraGrid({ entities }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [bust, setBust] = useState(() => Date.now());
  const [modalFailed, setModalFailed] = useState(false);

  // Refresh the open popup image periodically so it feels live. Pause while a
  // frame is failing (a resumed/throttled webview can request a since-rotated
  // signed token → HA 401s and logs it); the next render with a fresh token
  // retries and onLoad resumes the loop.
  useEffect(() => {
    if (!selected || modalFailed) return;
    const id = setInterval(() => setBust(Date.now()), 1000);
    return () => clearInterval(id);
  }, [selected, modalFailed]);

  // A different camera starts fresh.
  useEffect(() => {
    setModalFailed(false);
  }, [selected]);

  // Close popup on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const cols = columnsFor(cameras.length);
  const selectedCam = cameras.find((c) => c.entity_id === selected) || null;
  const selectedEntity = selectedCam ? entities[selectedCam.entity_id] : null;
  const selectedAvailable = !!selectedEntity && selectedEntity.state !== 'unavailable';

  return (
    <>
      <div
        className="camera-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cameras.map((cam) => {
          const entity = entities[cam.entity_id];
          const isAvailable = entity && entity.state !== 'unavailable';
          const imgUrl = isAvailable ? camSrc(entity, cam.entity_id) : '';

          return (
            <div
              key={cam.entity_id}
              className="camera-card"
              onClick={() => isAvailable && setSelected(cam.entity_id)}
            >
              {isAvailable && imgUrl ? (
                <img src={imgUrl} alt={cam.name} loading="lazy" />
              ) : (
                <div className="camera-offline">
                  <span className="mdi mdi-camera-off" />
                </div>
              )}
              <div className="camera-label">
                <span>{cam.name}</span>
                <span className={`status-badge ${isAvailable ? '' : 'offline'}`}>
                  {isAvailable ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCam && (
        <div className="camera-modal-overlay" onClick={() => setSelected(null)}>
          <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
            <div className="camera-modal-head">
              <span className="camera-modal-title">{selectedCam.name}</span>
              <button
                className="camera-modal-close"
                title="Close"
                onClick={() => setSelected(null)}
              >
                <span className="mdi mdi-close" />
              </button>
            </div>
            <div className="camera-modal-body">
              {selectedAvailable && selectedEntity ? (
                <img
                  src={camSrc(selectedEntity, selectedCam.entity_id, bust)}
                  alt={selectedCam.name}
                  onError={() => setModalFailed(true)}
                  onLoad={() => setModalFailed(false)}
                />
              ) : (
                <div className="camera-offline">
                  <span className="mdi mdi-camera-off" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
