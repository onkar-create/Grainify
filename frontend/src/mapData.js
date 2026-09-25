// Approximate real-world coordinates ([lat, lng]) for each FCI warehouse city.
export const WAREHOUSE_COORDS = {
  WH_Latur: [18.4088, 76.5604],
  WH_Nanded: [19.1383, 77.321],
  WH_Amravati: [20.9374, 77.7796],
  WH_Nagpur: [21.1458, 79.0882],
  WH_Nashik: [19.9975, 73.7898],
  WH_Pune: [18.5204, 73.8567],
  WH_Mumbai: [19.076, 72.8777],
};

// The GeoJSON's district boundaries are current-day (2014+ split), but our model
// uses 2011 Census-era districts (Palghar folded into Thane, and Mumbai City +
// Mumbai Suburban kept separate). This maps each GeoJSON polygon to the model
// district(s) whose data it should display — Palghar borrows Thane's numbers,
// and the single "Mumbai" polygon shows the combined Mumbai + Mumbai Suburban.
export const GEOJSON_TO_MODEL_DISTRICTS = {
  Palghar: ["Thane"],
  Mumbai: ["Mumbai", "Mumbai Suburban"],
};

export function modelDistrictsFor(geoJsonDistrictName) {
  return GEOJSON_TO_MODEL_DISTRICTS[geoJsonDistrictName] || [geoJsonDistrictName];
}
