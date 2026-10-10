// A small local Google basemap style. No satellite tiles, animated camera or POI clutter.
export const fieldMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#202020" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#E0E0E0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#606060" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#999999" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#080808" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#BBBBBB" }] },
];
