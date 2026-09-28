import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { WAREHOUSE_COORDS, modelDistrictsFor, geoJsonDistrictFor } from "../mapData";

// Validated sequential blue ramp (dataviz skill palette, steps 100-700): lightest
// = near-zero unmet demand, darkest = most severe shortage.
const UNMET_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

// Keeps the map locked to Maharashtra so the basemap can't be panned/zoomed out
// into neighbouring states (e.g. Rajasthan city labels showing up).
const MAHARASHTRA_BOUNDS = [
  [14.8, 71.8],
  [22.3, 81.2],
];

function unmetColor(unmetPct) {
  const step = Math.min(UNMET_RAMP.length - 1, Math.floor(unmetPct * UNMET_RAMP.length));
  return UNMET_RAMP[Math.max(0, step)];
}

// Mirrors src/config.py COST_PER_TONNE_PER_KM — used to estimate a route's
// transport cost client-side from quantity + distance, without a new API.
const COST_PER_TONNE_PER_KM = 2.5;

function warehouseIcon(active = false) {
  return L.divIcon({
    className: "warehouse-marker",
    html: `<div class="warehouse-marker-dot${active ? " warehouse-marker-dot-active" : ""}">W</div>`,
    iconSize: active ? [32, 32] : [26, 26],
    iconAnchor: active ? [16, 16] : [13, 13],
  });
}

function FlyToDistrict({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 8, { duration: 1 });
  }, [target, map]);
  return null;
}

export default function AllocationMap({ result, districts = [], focusDistrict = null }) {
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

  const focusGeoName = focusDistrict ? geoJsonDistrictFor(focusDistrict) : null;

  // Distances (km) for every warehouse that serves each district, sourced from
  // the districts prop's serving_warehouses list — used to estimate a route's
  // transport cost in its popup without adding a new API call.
  const distanceLookup = useMemo(() => {
    const map = {};
    for (const d of districts) {
      for (const w of d.serving_warehouses || []) {
        map[`${w.warehouse}|${d.name}`] = w.distance_km;
      }
    }
    return map;
  }, [districts]);

  const warehousesServingFocus = useMemo(() => {
    if (!focusDistrict || !result) return new Set();
    return new Set(result.routes.filter((r) => r.district === focusDistrict).map((r) => r.warehouse));
  }, [focusDistrict, result]);

  const style = (feature) => {
    const isFocused = feature.properties.district === focusGeoName;
    const stats = districtStats[feature.properties.district];
    const base = !stats || stats.demand <= 0
      ? { fillColor: "#e7e2d6", fillOpacity: 0.6 }
      : { fillColor: unmetColor(stats.optimized_unmet / stats.demand), fillOpacity: 0.75 };
    if (focusGeoName && !isFocused) {
      base.fillOpacity = Math.min(base.fillOpacity, 0.3);
    }
    return isFocused
      ? { ...base, fillOpacity: 0.85, weight: 3, color: "#b45309" }
      : { ...base, weight: 1, color: "#fff" };
  };

  useEffect(() => {
    geoJsonRef.current?.setStyle(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGeoName, districtStats]);

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
      <MapContainer
        center={[19.4, 76.5]}
        zoom={6}
        minZoom={6}
        maxZoom={11}
        scrollWheelZoom={false}
        maxBounds={MAHARASHTRA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {focusGeoName && districtCenters[focusGeoName] && (
          <FlyToDistrict target={districtCenters[focusGeoName]} />
        )}
        {geoData && (
          <GeoJSON
            ref={geoJsonRef}
            data={geoData}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
        {Object.entries(WAREHOUSE_COORDS).map(([wh, coords]) => (
          <Marker key={wh} position={coords} icon={warehouseIcon(warehousesServingFocus.has(wh))}>
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

              const isFocusedRoute = focusDistrict != null && r.district === focusDistrict;
              const dimmed = focusDistrict != null && !isFocusedRoute;
              const km = distanceLookup[`${wh}|${r.district}`];
              const cost = km != null ? r.quantity * km * COST_PER_TONNE_PER_KM : null;
              const weight = isFocusedRoute
                ? Math.min(10, 2 + r.quantity / 1200)
                : Math.min(8, 1 + r.quantity / 1500);

              // Leaflet renders markers in "markerPane", which sits ABOVE the default
              // overlay pane used by polylines/polygons — so a short route between a
              // warehouse and a nearby district can end up hidden entirely under the
              // warehouse's icon. Promoting the focused route into markerPane (plus a
              // light casing line for contrast) keeps it visible regardless of length
              // or how dark the underlying district shading is.
              return (
                <Fragment key={`${wh}-${r.district}`}>
                  {isFocusedRoute && (
                    <Polyline
                      positions={[from, to]}
                      pane="markerPane"
                      pathOptions={{ color: "#fff7ec", weight: weight + 5, opacity: 0.9 }}
                    />
                  )}
                  <Polyline
                    positions={[from, to]}
                    pane={isFocusedRoute ? "markerPane" : undefined}
                    pathOptions={{
                      color: "#b45309",
                      weight,
                      opacity: dimmed ? 0.15 : isFocusedRoute ? 0.95 : 0.55,
                    }}
                  >
                    <Tooltip sticky>
                      {wh.replace("WH_", "")} &rarr; {r.district}: {Math.round(r.quantity).toLocaleString()} t
                    </Tooltip>
                    <Popup>
                      <strong>{wh.replace("WH_", "")}</strong> &rarr; <strong>{r.district}</strong>
                      <br />
                      Quantity: {Math.round(r.quantity).toLocaleString()} t
                      {km != null && (
                        <>
                          <br />
                          Distance: {km} km
                        </>
                      )}
                      {cost != null && (
                        <>
                          <br />
                          Transport cost: &#8377;{Math.round(cost).toLocaleString()}
                        </>
                      )}
                    </Popup>
                  </Polyline>
                </Fragment>
              );
            })
          )}
      </MapContainer>
    </div>
  );
}
