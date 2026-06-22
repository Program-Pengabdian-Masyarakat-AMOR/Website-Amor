import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { formatAngka } from '../lib/format';

// Bar chart penjualan per bulan. Dipisah agar Recharts bisa di-lazy-load
// (code-splitting) — lihat pemakaian di pages/dashboard/Sales.jsx.
export default function SalesBarChart({ data = [], isHighlighted = () => false, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="#E6E0D6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A857C', fontFamily: 'Plus Jakarta Sans' }} tickLine={false} axisLine={{ stroke: '#E6E0D6' }} />
        <YAxis tick={{ fontSize: 10.5, fill: '#8A857C', fontFamily: 'Plus Jakarta Sans' }} tickLine={false} axisLine={false} width={38} />
        <Tooltip
          cursor={{ fill: 'rgba(217,100,30,.06)' }}
          contentStyle={{ background: '#1C1B19', border: 'none', borderRadius: 10, color: '#F1EDE6', fontSize: 12 }}
          labelStyle={{ color: '#fff' }}
          formatter={(v) => [`${formatAngka(v)} liter`, 'Terjual']}
        />
        <Bar dataKey="liter" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((m) => (
            <Cell
              key={m.key}
              fill={isHighlighted(m.key) ? '#D9641E' : '#E7ECE3'}
              stroke={isHighlighted(m.key) ? '#A8501A' : '#D2DCCC'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
