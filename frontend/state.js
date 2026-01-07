let isFetching = false;

let rawMapData = [];
let normalizedData = [];

let activeFilter = DEFAULT_INITIAL_FILTER;

// Leaflet refs
let map;
let markerLayer;

let editingQr = null;

