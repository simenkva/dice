import { DiceSimulation } from "./simulation.js";
import { setupControls } from "./ui.js";

const sliderContainer = document.getElementById("sliderContainer");
const rollButton = document.getElementById("rollButton");
const renderHost = document.getElementById("renderHost");
const hud = document.getElementById("hud");
const zoomSlider = document.getElementById("zoomSlider");
const zoomValue = document.getElementById("zoomValue");

const simulation = new DiceSimulation({
  host: renderHost,
  hud,
});

setupControls({
  sliderContainer,
  rollButton,
  onRoll: (countsByType) => simulation.roll(countsByType),
});

function applyZoomFromSlider() {
  const normalized = Number(zoomSlider.value) / 100;
  simulation.setZoomNormalized(normalized);
  zoomValue.textContent = `${Math.round(normalized * 100)}%`;
}

zoomSlider.addEventListener("input", applyZoomFromSlider);
applyZoomFromSlider();
