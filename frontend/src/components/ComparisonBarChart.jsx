import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ComparisonBarChart({ baselineLabel, baselineValue, optimizedLabel, optimizedValue, valueFormatter }) {
  const data = [
    { name: "Baseline\n(proportional)", value: baselineValue, fill: "#94a3b8" },
    { name: "Optimized\n(Min-Cost Max-Flow)", value: optimizedValue, fill: "#2563eb" },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d6" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={valueFormatter} width={70} />
        <Tooltip formatter={(v) => valueFormatter(v)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
