import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function DistrictChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={460}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 90 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d6" vertical={false} />
        <XAxis dataKey="district" tick={{ fontSize: 10 }} angle={-60} textAnchor="end" interval={0} height={90} />
        <YAxis tick={{ fontSize: 11 }} width={60} />
        <Tooltip />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
        <Bar dataKey="demand" name="Predicted demand" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
        <Bar dataKey="baseline" name="Baseline allocation" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="optimized" name="Optimized allocation" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
