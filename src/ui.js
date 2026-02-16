import { DIE_ORDER, clampSliderValue } from "./dice-data.js";

function makeSliderRow(type) {
  const row = document.createElement("div");
  row.className = "slider-row";

  const label = document.createElement("label");
  label.className = "slider-label";
  label.textContent = type;

  const valueText = document.createElement("output");
  valueText.className = "slider-value";
  valueText.textContent = "0";

  const slider = document.createElement("input");
  slider.className = "die-slider";
  slider.type = "range";
  slider.id = `${type}-slider`;
  slider.name = `${type}-slider`;
  slider.min = "0";
  slider.max = "6";
  slider.step = "1";
  slider.value = "0";

  label.setAttribute("for", slider.id);

  slider.addEventListener("input", () => {
    valueText.textContent = String(clampSliderValue(slider.value));
  });

  row.append(label, valueText, slider);
  return { type, row, slider };
}

export function setupControls({ sliderContainer, rollButton, onRoll }) {
  const sliderRefs = new Map();

  for (const type of DIE_ORDER) {
    const sliderRef = makeSliderRow(type);
    sliderContainer.append(sliderRef.row);
    sliderRefs.set(type, sliderRef.slider);
  }

  function readCounts() {
    const counts = {};

    for (const [type, slider] of sliderRefs) {
      counts[type] = clampSliderValue(slider.value);
    }

    return counts;
  }

  rollButton.addEventListener("click", () => {
    onRoll(readCounts());
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      onRoll(readCounts());
    }
  });
}
