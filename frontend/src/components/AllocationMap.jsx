import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { WAREHOUSE_COORDS, modelDistrictsFor } from "../mapData";

// Validated sequential blue ramp (dataviz skill palette, steps 100-700): lightest
// = near-zero unmet demand, darkest = most severe shortage.
const UNMET_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

function unmetColor(unmetPct) {
  const step = Math.min(UNMET_RAMP.length - 1, Math.floor(unmetPct * UNMET_RAMP.length));
  return UNMET_RAMP[Math.max(0, step)];
}

function warehouseIcon() {
  return L.divIcon({
    className: "warehouse-marker",
    html: `<div class="warehouse-marker-dot">W</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function AllocationMap({ result, districts = [] }) {
  const [geoData, setGeoData] = useState(null);
  const [districtCenters, setDistrictCenters] = useState({});
  const geoJsonRef = useRef(null);

  useEffect(() => {
    fetch("/geo/maharashtra_districts.geojson")
      .then((r) => r.json())
      .then(setGeoData)
      .catch(() => setGeoData(null));
  }, []);

  const populationByDistrict = useMemo(
    () => Object.fromEntries(districts.map((d) => [d.name, d.population])),
    [districts]
  );

  const districtStats = useMemo(() => {
    if (!result) return {};
    const byDistrict = Object.fromEntries(result.district_results.map((d) => [d.district, d]));
    const stats = {};
    if (!geoData) return stats;
    for (const feature of geoData.features) {
      const geoName = feature.properties.district;
      const modelNames = modelDistrictsFor(geoName);
      const rows = modelNames.map((n) => byDistrict[n]).filter(Boolean);
      if (rows.length === 0) continue;
      const demand = rows.reduce((s, r) => s + r.demand, 0);
      const optimized_allocation = rows.reduce((s, r) => s + r.optimized_allocation, 0);
      const optimized_unmet = rows.reduce((s, r) => s + r.optimized_unmet, 0);
      const population = modelNames.reduce((s, n) => s + (populationByDistrict[n] || 0), 0);
      const servingWarehouses = [
        ...new Set(
          result.routes
            .filter((r) => modelNames.includes(r.district))
            .map((r) => r.warehouse.replace("WH_", ""))
        ),
      ];
      stats[geoName] = { demand, optimized_allocation, optimized_unmet, population, servingWarehouses, modelNames };
    }
    return stats;
  }, [result, geoData, populationByDistrict]);

  const routesByWarehouse = useMemo(() => {
    if (!result) return {};
    const grouped = {};
    for (const r of result.routes) {
      (grouped[r.warehouse] ||= []).push(r);
    }
    return grouped;
  }, [result]);

  const style = (feature) => {
    const stats = districtStats[feature.properties.district];
    if (!stats || stats.demand <= 0) {
      return { fillColor: "#e7e2d6", weight: 1, color: "#fff", fillOpacity: 0.6 };
    }
    const unmetPct = stats.optimized_unmet / stats.demand;
    return {
      fillColor: unmetColor(unmetPct),
      weight: 1,
      color: "#fff",
      fillOpacity: 0.75,
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.district;
    const stats = districtStats[name];
    const center = layer.getBounds().getCenter();
    setDistrictCenters((prev) =>
      prev[name] ? prev : { ...prev, [name]: [center.lat, center.lng] }
    );

    const tooltipLabel = stats
      ? `<strong>${name}</strong><br/>Demand: ${Math.round(stats.demand).toLocaleString()} t &middot; ` +
        `Unmet: ${Math.round(stats.optimized_unmet).toLocaleString()} t`
      : `<strong>${name}</strong>`;
    layer.bindTooltip(tooltipLabel, { sticky: true });

    const popupLabel = stats
      ? `<strong>${name}</strong><br/>` +
        `Population: ${stats.population ? stats.population.toLocaleString() : "n/a"}<br/>` +
        `Predicted demand: ${Math.round(stats.demand).toLocaleString()} t<br/>` +
        `Optimized allocation: ${Math.round(stats.optimized_allocation).toLocaleString()} t<br/>` +
        `Unmet demand: ${Math.round(stats.optimized_unmet).toLocaleString()} t<br/>` +
        `Served by: ${stats.servingWarehouses.length ? stats.servingWarehouses.join(", ") : "none this run"}`
      : `<strong>${name}</strong><br/>No data for this run`;
    layer.bindPopup(popupLabel);
  };

  return (
    <div className="map-wrapper">
      <MapContainer center={[19.4, 76.5]} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <GeoJSON
            ref={geoJsonRef}
            data={geoData}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
        {Object.entries(WAREHOUSE_COORDS).map(([wh, coords]) => (
          <Marker key={wh} position={coords} icon={warehouseIcon()}>
            <Popup>
              <strong>{wh.replace("WH_", "")}</strong> warehouse
              {result && (
                <>
                  <br />
                  Serving {(routesByWarehouse[wh] || []).length} district
                  {(routesByWarehouse[wh] || []).length === 1 ? "" : "s"} this run
                </>
              )}
            </Popup>
          </Marker>
        ))}
        {result &&
          Object.entries(routesByWarehouse).map(([wh, routes]) =>
            routes.map((r) => {
              // r.district is a model district name (e.g. "Mumbai Suburban"), which
              // may not have its own GeoJSON polygon — fall back to whichever
              // polygon's model-district mapping includes it (e.g. the "Mumbai" one).
              const geoName =
                districtCenters[r.district] != null
                  ? r.district
                  : Object.keys(districtCenters).find((k) => modelDistrictsFor(k).includes(r.district));
              const to = districtCenters[geoName];
              const from = WAREHOUSE_COORDS[wh];
              if (!to || !from) return null;
              const weight = Math.min(8, 1 + r.quantity / 1500);
              return (
                <Polyline
                  key={`${wh}-${r.district}`}
                  positions={[from, to]}
                  pathOptions={{ color: "#b45309", weight, opacity: 0.55 }}
                >
                  <Tooltip sticky>
                    {wh.replace("WH_", "")} &rarr; {r.district}: {Math.round(r.quantity).toLocaleString()} t
                  </Tooltip>
                </Polyline>
              );
            })
          )}
      </MapContainer>
    </div>
  );
}
