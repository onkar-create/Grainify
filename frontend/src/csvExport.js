function toCsvValue(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exports the optimized warehouse -> district routing plan for a scenario run. */
export function downloadDistributionPlanCsv(result) {
  const rows = [["Warehouse", "District", "Quantity (tonnes)"]];
  for (const r of result.routes) {
    rows.push([r.warehouse.replace("WH_", ""), r.district, Math.round(r.quantity)]);
  }
  rows.push([]);
  rows.push(["District", "Demand (t)", "Optimized Allocation (t)", "Unmet (t)"]);
  for (const d of result.district_results) {
    rows.push([
      d.district,
      Math.round(d.demand),
      Math.round(d.optimized_allocation),
      Math.round(d.optimized_unmet),
    ]);
  }

  const csv = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
  const filename = `grainify-distribution-plan-${result.scenario.replace(/\s+/g, "_")}-${result.id}.csv`;
  triggerDownload(filename, csv);
}
