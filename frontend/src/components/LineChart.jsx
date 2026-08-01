import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// Wrapper Recharts terpusat (lihat docs/CLAUDE.md → components/LineChart).
// Mendukung: beberapa garis, area gradient, sumbu kiri+kanan (dual axis), garis target.
//
// props:
//   data        : array objek
//   xKey        : key sumbu-x
//   lines       : [{ dataKey, name, color, yAxisId?='left', area?, unit? }]
//   leftAxis    : { domain?, color?, hide? }
//   rightAxis   : { domain?, color?, hide? }  (aktifkan dual axis)
//   referenceY  : { value, label?, color?, yAxisId?='left' }
//   height      : number (default 240)

const TICK = { fontSize: 10.5, fontFamily: 'Plus Jakarta Sans', fill: '#8A857C' };

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-tinta text-[#F1EDE6] rounded-[10px] px-3 py-2 text-[12px] shadow-2">
      <div className="font-semibold mb-1 text-white">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <b className="text-white tnum">{p.value}</b>
          {p.unit ? ` ${p.unit}` : ''}
        </div>
      ))}
    </div>
  );
}

export default function LineChart({
  data = [],
  xKey,
  lines = [],
  leftAxis = {},
  rightAxis,
  referenceY,
  height = 240,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: rightAxis ? 12 : 16, bottom: 4, left: 0 }}>
        <defs>
          {lines
            .filter((l) => l.area)
            .map((l) => (
              <linearGradient key={l.dataKey} id={`grad-${l.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={l.color} stopOpacity={0} />
              </linearGradient>
            ))}
        </defs>

        <CartesianGrid stroke="#E6E0D6" vertical={false} />
        <XAxis dataKey={xKey} tick={TICK} tickLine={false} axisLine={{ stroke: '#E6E0D6' }} />
        <YAxis
          yAxisId="left"
          domain={leftAxis.domain || ['auto', 'auto']}
          hide={leftAxis.hide}
          tick={{ ...TICK, fill: leftAxis.color || '#8A857C', fontWeight: leftAxis.color ? 600 : 400 }}
          tickLine={false}
          axisLine={false}
          width={38}
        />
        {rightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightAxis.domain || ['auto', 'auto']}
            tick={{ ...TICK, fill: rightAxis.color || '#8A857C', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
        )}

        <Tooltip content={<TooltipBox />} cursor={{ stroke: '#D8D1C4', strokeWidth: 1 }} />

        {referenceY && (
          <ReferenceLine
            y={referenceY.value}
            yAxisId={referenceY.yAxisId || 'left'}
            stroke={referenceY.color || '#3A4D39'}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            label={
              referenceY.label
                ? { value: referenceY.label, position: 'right', fill: referenceY.color || '#3A4D39', fontSize: 11 }
                : undefined
            }
          />
        )}

        {lines.map((l) =>
          l.area ? (
            <Area
              key={l.dataKey}
              type="monotone"
              yAxisId={l.yAxisId || 'left'}
              dataKey={l.dataKey}
              name={l.name}
              unit={l.unit}
              stroke={l.color}
              strokeWidth={2.5}
              fill={`url(#grad-${l.dataKey})`}
              dot={false}
              activeDot={{ r: 5, fill: '#FCFAF6', stroke: l.color, strokeWidth: 2.5 }}
            />
          ) : (
            <Line
              key={l.dataKey}
              type="monotone"
              yAxisId={l.yAxisId || 'left'}
              dataKey={l.dataKey}
              name={l.name}
              unit={l.unit}
              stroke={l.color}
              strokeWidth={2.5}
              strokeDasharray={l.dash ? '6 5' : undefined}
              dot={l.dot ? { r: 3, fill: l.color } : false}
              activeDot={{ r: 5, fill: '#FCFAF6', stroke: l.color, strokeWidth: 2.5 }}
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
