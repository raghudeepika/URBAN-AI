const PALETTE = [
  "#4ef2d0",
  "#ffb86b",
  "#ff6f91",
  "#76a8ff",
  "#b693ff",
  "#6ff7a7",
  "#ffd166",
  "#ff8fab",
  "#89f0ff",
  "#f6f7a6",
];

const CITY_ORDER = [
  "zurich",
  "sanfrancisco",
  "melbourne",
  "mumbai",
  "rio",
  "capetown",
];

const FIELD_LABELS = {
  main_facad: "Main Facade Material",
  material: "Main Facade Material",
  building_c: "Building Condition",
  bldg_cond: "Building Condition",
  architectu: "Architectural Style",
  building_t: "Building Type",
  roof: "Roof Type",
  roof_type: "Roof Type",
  energy_ass: "Energy Assessment Proxy",
  flood_asse: "Flood Exposure Proxy",
  flood_prxy: "Flood Exposure Proxy",
  heritage_s: "Historical Facade Indicators",
  seismic_vu: "Seismic Retrofit Proxy",
  number_of_: "Number of Storeys",
  storeys: "Number of Storeys",
};

const state = {
  siteData: null,
  currentCity: null,
  currentField: null,
  map: null,
  materialsLayer: null,
  materialGeoJson: null,
};

const citySelect = document.getElementById("city-select");
const fieldSelect = document.getElementById("field-select");

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function renderPaper(data) {
  document.getElementById("paper-abstract").textContent = data.paper.abstract;
  document.getElementById("paper-link").href = data.paper.pdf;
  document.getElementById("authors-line").innerHTML =
    "Deepika Raghu<sup>1</sup> · Iro Armeni<sup>2</sup> · Catherine De Wolf<sup>1</sup>";
  document.getElementById("affiliations").innerHTML = data.paper.affiliations
    .map((item) => `<div>${item}</div>`)
    .join("");
  document.getElementById("citation-text").textContent = data.paper.citation;
  document.getElementById("figure-caption").textContent = data.paper.figureCitation;

  document.getElementById("metrics-grid").innerHTML = data.metrics
    .map(
      (metric) => `
    <article class="metric">
      <div class="metric-value">${metric.value}</div>
      <div class="metric-label">${metric.label}</div>
    </article>
  `
    )
    .join("");

  document.getElementById("city-cards").innerHTML = data.cities
    .map(
      (city) => {
        return `
    <article class="card city-card">
      <div class="city-card-top">
        <div class="city-thumb-wrap">
          <img class="city-thumb" src="${city.previewImage}" alt="${city.name} preview of mapped results" />
        </div>
        <div>
      <h3>${city.name}</h3>
      <div class="city-meta">City-Specific Indicators: ${city.focus}</div>
        </div>
      </div>
      <p>${city.downloadDescription}</p>
      <div class="tag-row">${[
        ...city.mapFields,
        ...(city.slug === "capetown" ? ["facade_greening_indicators"] : []),
        ...(city.slug === "mumbai" ? ["morphology_indicators"] : []),
      ]
        .map((field) => `<span class="tag">${fieldLabel(field)}</span>`)
        .join("")}</div>
      <div class="download-links" style="margin-top:16px;">
        <a class="inline-link" href="${city.downloads.materials}" target="_blank" rel="noreferrer">Download ${city.name} results shapefile (.zip)</a>
      </div>
    </article>
  `
      }
    )
    .join("");
}

function initMap() {
  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
    worldCopyJump: false,
    scrollWheelZoom: false,
  }).setView([20, 0], 2);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  ).addTo(state.map);

  state.map.on("click", () => {
    state.map.scrollWheelZoom.enable();
  });

  state.map.on("mouseout", () => {
    state.map.scrollWheelZoom.disable();
  });
}

function buildPopup(properties, title) {
  const rows = Object.entries(properties)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`)
    .join("");

  return `<div class="popup"><h4>${title}</h4><dl>${
    rows || "<div><dd>No attributes available</dd></div>"
  }</dl></div>`;
}

function createColorScale(values) {
  const uniqueValues = [
    ...new Set(values.filter((value) => value !== null && value !== undefined)),
  ];

  return uniqueValues.reduce((acc, value, index) => {
    acc[String(value)] = PALETTE[index % PALETTE.length];
    return acc;
  }, {});
}

function renderLegend(colorScale, counts) {
  const label = fieldLabel(state.currentField);
  const orderedEntries = Object.entries(colorScale).sort(([a], [b]) => {
    const aLow = a.toLowerCase();
    const bLow = b.toLowerCase();
    const aSpecial = aLow === "unknown" || aLow === "not visible";
    const bSpecial = bLow === "unknown" || bLow === "not visible";
    if (aSpecial && !bSpecial) return 1;
    if (!aSpecial && bSpecial) return -1;
    return 0;
  });
  document.getElementById("legend").innerHTML =
    `<div class="legend-field">${label}</div>` +
    orderedEntries
      .map(
        ([label, color]) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${color}"></span>
      <span>${label}</span>
      <strong>${counts?.[label] ?? ""}</strong>
    </div>
  `
      )
      .join("") || "<p>No categories available for this field.</p>";
}

function fieldLabel(field) {
  if (field === "facade_greening_indicators") return "Facade Greening Indicators";
  if (field === "morphology_indicators") return "Morphology Indicators";
  return FIELD_LABELS[field] || field;
}

function fitToBounds(bounds) {
  state.map.fitBounds(
    L.latLngBounds([bounds[1], bounds[0]], [bounds[3], bounds[2]]),
    { padding: [24, 24] }
  );
}

function materialStyle(color) {
  return {
    color,
    weight: 1.4,
    opacity: 0.92,
    fillColor: color,
    fillOpacity: 0.76,
  };
}

function drawLayers() {
  if (state.materialsLayer) state.map.removeLayer(state.materialsLayer);
  const values = state.materialGeoJson.features.map(
    (feature) => feature.properties[state.currentField]
  );
  const colorScale = createColorScale(values);

  state.materialsLayer = L.geoJSON(state.materialGeoJson, {
    style: (feature) => {
      const color =
        colorScale[String(feature.properties[state.currentField])] || "#76a8ff";
      return materialStyle(color);
    },
    pointToLayer: (feature, latlng) => {
      const color =
        colorScale[String(feature.properties[state.currentField])] || "#76a8ff";
      return L.circleMarker(latlng, {
        radius: 7,
        color: "#041014",
        weight: 1.5,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.96,
      });
    },
    onEachFeature: (feature, layer) =>
      layer.bindPopup(buildPopup(feature.properties, `${state.currentCity.name} result`)),
  }).addTo(state.map);

  renderLegend(colorScale, state.currentCity.categories[state.currentField]);
}

function updateCityPanel() {
  document.getElementById("city-name").textContent = state.currentCity.name;
  document.getElementById("city-focus").textContent =
    `City-Specific Indicators: ${state.currentCity.focus}`;
}

function populateFieldOptions(city) {
  fieldSelect.innerHTML = city.mapFields
    .map((field) => `<option value="${field}">${fieldLabel(field)}</option>`)
    .join("");
  if (!city.mapFields.includes(state.currentField)) {
    state.currentField = city.mapFields[0];
  }
  fieldSelect.value = state.currentField;
}

async function loadCity(slug) {
  state.currentCity = state.siteData.cities.find((item) => item.slug === slug);
  populateFieldOptions(state.currentCity);
  updateCityPanel();

  state.materialGeoJson = await loadJson(`./data/${slug}-materials.geojson`);
  drawLayers();
  fitToBounds(state.currentCity.bounds.materials);
}

async function boot() {
  state.siteData = await loadJson("./data/site-data.json");
  state.siteData.cities.sort(
    (a, b) => CITY_ORDER.indexOf(a.slug) - CITY_ORDER.indexOf(b.slug)
  );
  renderPaper(state.siteData);
  initMap();

  citySelect.innerHTML = state.siteData.cities
    .map((city) => `<option value="${city.slug}">${city.name}</option>`)
    .join("");

  citySelect.addEventListener("change", async (event) => loadCity(event.target.value));
  fieldSelect.addEventListener("change", (event) => {
    state.currentField = event.target.value;
    drawLayers();
  });

  const initialCity = state.siteData.cities[0];
  const defaultCity =
    state.siteData.cities.find((city) => city.slug === "zurich") || initialCity;
  citySelect.value = defaultCity.slug;
  state.currentField = defaultCity.mapFields[0];
  await loadCity(defaultCity.slug);
}

boot().catch((error) => {
  console.error(error);
  document.getElementById("paper-abstract").textContent =
    "The site data could not be loaded. Run a local web server from this folder and refresh the page.";
});
