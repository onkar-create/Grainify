import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function DistrictChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d6" vertical={false} />
        <XAxis dataKey="district" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} width={60} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="demand" name="Predicted demand" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
        <Bar dataKey="baseline" name="Baseline allocation" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="optimized" name="Optimized allocation" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
