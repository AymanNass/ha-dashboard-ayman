import { useMemo } from 'react';

interface Props {
  data: number[];
  hours: number;
  unit: string;
  color: string;
  label: string;
}

/** Chart with labeled X (hours) and Y (value) axes. */
export function DetailChart({ data, hours, unit, color, label }: Props) {
  const W = 560;
  const H = 200;
  const PAD = { top: 20, right: 16, bottom: 28, left: 44 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const { points, yMin, yMax, yTicks, xTicks } = useMemo(() => {
    if (data.length < 2) return { points: '', yMin: 0, yMax: 1, yTicks: [] as number[], xTicks: [] as number[] };

    const min = Math.min(...data);
    const max = Math.max(...data);
    // Add 5% padding to Y range
    const range = max - min || 1;
    const yLo = min - range * 0.05;
    const yHi = max + range * 0.05;

    const stepX = cw / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = PAD.left + i * stepX;
      const y = PAD.top + ch - ((v - yLo) / (yHi - yLo)) * ch;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Y ticks: 4-5 evenly spaced
    const yStep = range / 4;
    const yTicksArr: number[] = [];
    for (let i = 0; i <= 4; i++) {
      yTicksArr.push(min + yStep * i);
    }

    // X ticks: hour labels
    const now = new Date();
    const xTicksArr: number[] = [];
    const tickCount = Math.min(hours, 8);
    for (let i = 0; i <= tickCount; i++) {
      xTicksArr.push(i);
    }

    return { points: pts, yMin: yLo, yMax: yHi, yTicks: yTicksArr, xTicks: xTicksArr };
  }, [data, hours, cw, ch]);

  if (data.length < 2) {
    return <div className="dchart-empty">Caricamento dati...</div>;
  }

  const now = new Date();

  // Area fill
  const area = `${points} L${PAD.left + cw} ${PAD.top + ch} L${PAD.left} ${PAD.top + ch} Z`;

  return (
    <div className="dchart">
      <div className="dchart-label">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dchart-svg">
        <defs>
          <linearGradient id={`dcg-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => {
          const y = PAD.top + ch - ((v - (Math.min(...data) - (Math.max(...data) - Math.min(...data) || 1) * 0.05)) / ((Math.max(...data) + (Math.max(...data) - Math.min(...data) || 1) * 0.05) - (Math.min(...data) - (Math.max(...data) - Math.min(...data) || 1) * 0.05))) * ch;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left + cw} y2={y} stroke="var(--border-glass)" strokeWidth="0.5" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="inherit">
                {v.toFixed(1)}{unit}
              </text>
            </g>
          );
        })}

        {/* X axis labels (hours ago) */}
        {xTicks.map((i) => {
          const x = PAD.left + (i / hours) * cw;
          const hourLabel = new Date(now.getTime() - (hours - i) * 3600000);
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="inherit">
              {hourLabel.getHours().toString().padStart(2, '0')}:00
            </text>
          );
        })}

        {/* Area + Line */}
        <path d={area} fill={`url(#dcg-${label.replace(/\s/g, '')})`} />
        <path d={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Current value dot */}
        {data.length > 0 && (() => {
          const lastVal = data[data.length - 1];
          const lx = PAD.left + cw;
          const ly = PAD.top + ch - ((lastVal - (Math.min(...data) - (Math.max(...data) - Math.min(...data) || 1) * 0.05)) / ((Math.max(...data) + (Math.max(...data) - Math.min(...data) || 1) * 0.05) - (Math.min(...data) - (Math.max(...data) - Math.min(...data) || 1) * 0.05))) * ch;
          return <circle cx={lx} cy={ly} r="3" fill={color} />;
        })()}
      </svg>
      <div className="dchart-minmax">
        <span>Min: {Math.min(...data).toFixed(1)}{unit}</span>
        <span>Attuale: {data[data.length - 1]?.toFixed(1)}{unit}</span>
        <span>Max: {Math.max(...data).toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  charts: { data: number[]; unit: string; color: string; label: string }[];
  onClose: () => void;
}

export function DetailChartModal({ title, charts, onClose }: ModalProps) {
  return (
    <div className="ts-overlay" onClick={onClose}>
      <div className="ts-modal dchart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ts-head">
          <h3><span className="mdi mdi-chart-line" /> {title} — 24h</h3>
          <button className="edit-icon-btn" onClick={onClose}><span className="mdi mdi-close" /></button>
        </div>
        <div className="ts-body">
          {charts.map((c, i) => (
            <DetailChart key={i} data={c.data} hours={24} unit={c.unit} color={c.color} label={c.label} />
          ))}
        </div>
      </div>
    </div>
  );
}
