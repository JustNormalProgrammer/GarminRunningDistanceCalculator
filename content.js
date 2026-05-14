(function () {
  const ADAPTIVE_PLAN = "[class*='adaptiveCoachContainer']";
  const MODAL = "class*='modal-calendar-event'";
  const SUMMARY_SELECTOR = ".workout-summary";
  const RESULT_ID = "garmin-distance-calculator-total";
  const STEP_SELECTOR = ".workout-step-container-in-modal";
  const REPEAT_SELECTOR = ".block-repeat";
  const HEADER_SELECTOR = ".block-header";
  const VALUE_SELECTOR = "[class*='workoutStepDataValue']";
  const LABEL_SELECTOR = "[class*='workoutStepDataLabel']";
  const MODAL_CONTENT_SELECTOR = "[class*='workoutModalContent']";
  const DATA_BLOCKS_SELECTOR = "[class*='dataBlocks']";
  const METRIC_BLOCK_SELECTOR = "[class*='block']";
  const METRIC_VALUE_SELECTOR = "[class*='blockText']";
  const METRIC_LABEL_SELECTOR = "[class*='blockLabel']";
  const DEBUG_PREFIX = "[Garmin Distance Calculator]";
  const DEBUG = false;

  let lastDebugSnapshot = "";

  function isAdaptivePlan() {
    return document.querySelector(ADAPTIVE_PLAN) !== null;
  }

  function warn(...args) {
    if (DEBUG) {
      console.warn(DEBUG_PREFIX, ...args);
    }
  }

  function parseDistance(value) {
    const match = value.replace(",", ".").match(/([\d.]+)\s*km/i);
    return match ? Number(match[1]) : 0;
  }

  function getStepDistance(step) {
    const labels = step.querySelectorAll(LABEL_SELECTOR);

    if (!labels.length) {
      warn("Step has no distance labels", step);
    }

    for (const label of labels) {
      if (label.textContent.trim().toLowerCase() !== "est distance") {
        continue;
      }

      const row = label.parentElement;
      const value = row ? row.querySelector(VALUE_SELECTOR) : null;

      if (!value) {
        warn("Found Est Distance label, but no matching value element", label);
        return 0;
      }

      return parseDistance(value.textContent);
    }

    return 0;
  }

  function getDirectRepeatMultiplier(repeatBlock) {
    const header = Array.from(repeatBlock.children).find((child) =>
      child.matches(HEADER_SELECTOR),
    );
    const match = header ? header.textContent.match(/(\d+)\s*Times/i) : null;

    return match ? Number(match[1]) : 1;
  }

  function getRepeatMultiplier(element, summary) {
    let multiplier = 1;
    let parent = element.parentElement;

    while (parent && parent !== summary) {
      if (parent.matches(REPEAT_SELECTOR)) {
        multiplier *= getDirectRepeatMultiplier(parent);
      }

      parent = parent.parentElement;
    }

    return multiplier;
  }

  function calculateTotalDistance(summary) {
    const steps = Array.from(summary.querySelectorAll(STEP_SELECTOR));
    const details = steps.map((step) => {
      const title =
        step.querySelector("[title]")?.getAttribute("title") ||
        step
          .querySelector("[class*='workoutStepInnerTitle']")
          ?.textContent.trim() ||
        "Unknown";
      const distance = getStepDistance(step);
      const multiplier = getRepeatMultiplier(step, summary);

      return {
        title,
        distance,
        multiplier,
        total: distance * multiplier,
      };
    });

    warn("Step details", details);

    return details.reduce((total, step) => total + step.total, 0);
  }

  function formatDistance(distance) {
    return `${distance.toFixed(2)} km`;
  }

  function createResultElement() {
    const container = document.createElement("div");
    container.id = RESULT_ID;
    container.style.minWidth = "160px";

    const value = document.createElement("div");
    value.dataset.garminDistanceValue = "true";

    const label = document.createElement("div");
    label.textContent = "Total Distance";

    container.append(value, label);

    return container;
  }


  function applyMetricClasses(result, resultHost) {
    const existingBlock = resultHost.querySelector(METRIC_BLOCK_SELECTOR);
    const existingValue = resultHost.querySelector(METRIC_VALUE_SELECTOR);
    const existingLabel = resultHost.querySelector(METRIC_LABEL_SELECTOR);
    const value = result.querySelector("[data-garmin-distance-value]");
    const label = value?.nextElementSibling;

    if (existingBlock?.className) {
      result.className = existingBlock.className;
    }

    if (existingValue?.className && value) {
      value.className = existingValue.className;
    }

    if (existingLabel?.className && label) {
      label.className = existingLabel.className;
    }
  }

  function renderDistance(summary) {
    const distance = calculateTotalDistance(summary);
    const modalContent = summary.closest(MODAL_CONTENT_SELECTOR);
    const resultHost = modalContent?.querySelector(DATA_BLOCKS_SELECTOR);;
    let result = resultHost.querySelector(`#${RESULT_ID}`);
    const staleResults = Array.from(
      (modalContent || summary).querySelectorAll(`#${RESULT_ID}`),
    ).filter((element) => element.parentElement !== resultHost);

    warn("Calculated total distance", distance, summary);

    if (!distance) {
      warn("Distance is zero, result will not be displayed", summary);
      result?.remove();
      staleResults.forEach((element) => element.remove());
      return;
    }

    staleResults.forEach((element) => element.remove());

    if (!result) {
      result = createResultElement();
      resultHost.appendChild(result);
      applyMetricClasses(result, resultHost);
      warn("Distance element appended", result);
    }

    const value = result.querySelector("[data-garmin-distance-value]");
    const formattedDistance = formatDistance(distance);

    if (value.textContent !== formattedDistance) {
      value.textContent = formattedDistance;
    }
  }

  function updateAllSummaries() {
    if (!isAdaptivePlan()) {
      return;
    }

    scheduled = false;
    const snapshot = JSON.stringify({
      steps: document.querySelectorAll(STEP_SELECTOR).length,
      labels: document.querySelectorAll(LABEL_SELECTOR).length,
      values: document.querySelectorAll(VALUE_SELECTOR).length,
    });

    if (snapshot !== lastDebugSnapshot) {
      lastDebugSnapshot = snapshot;
      warn("DOM snapshot", JSON.parse(snapshot));
    }

    const summary = document.querySelector(SUMMARY_SELECTOR);

    if (!summary) {
      warn("No workout summary found yet");
    }

    renderDistance(summary);
  }

  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateAllSummaries();
    }, 200);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
