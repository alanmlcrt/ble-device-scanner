/* ============================================================
   Flipper Zero BLE Scanner - 100% Web Bluetooth
   Mode 1: Scan Passif (requestLEScan) - Experimental
   Mode 2: Sélecteur Classique (requestDevice) - Fallback
   ============================================================ */

(function () {
  "use strict";

  const FLIPPER_COMPANY_ID = 0x0171;
  const SCAN_DURATION = 15;

  // --- DOM Elements ---
  const scanBtn = document.getElementById("scanBtn");
  const scanBtnLabel = scanBtn.querySelector(".scan-button-label");
  const scanBtnIcon = scanBtn.querySelector(".scan-button-icon");
  const browserWarning = document.getElementById("browserWarning");
  const iphoneWarning = document.getElementById("iphoneWarning");
  const flagWarning = document.getElementById("flagWarning");
  const scannerSection = document.getElementById("scannerSection");
  const radarContainer = document.getElementById("radarContainer");
  const flipperResults = document.getElementById("flipperResults");
  const resultsList = document.getElementById("resultsList");
  const otherDevicesWrapper = document.getElementById("otherDevicesWrapper");
  const otherDevicesCount = document.getElementById("otherDevicesCount");
  const noResults = document.getElementById("noResults");
  const scanAgainBtn = document.getElementById("scanAgainBtn");
  const fallbackScanBtn = document.getElementById("fallbackScanBtn");
  const scanStatus = document.getElementById("scanStatus");
  const statusDot = scanStatus.querySelector(".status-dot");
  const statusText = scanStatus.querySelector(".status-text");
  const timerDisplay = document.getElementById("timerDisplay");
  
  const logSection = document.getElementById("logSection");
  const logBody = document.getElementById("logBody");
  const logEntries = document.getElementById("logEntries");
  const logCount = document.getElementById("logCount");
  const logToggle = document.getElementById("logToggle");
  const logChevron = document.getElementById("logChevron");
  const logClearBtn = document.getElementById("logClearBtn");

  // --- State ---
  let isScanning = false;
  let detectedDevices = [];
  let currentScan = null;
  let advertHandler = null;
  let countdownInterval = null;
  let logCounter = 0;
  let advertCounter = 0;

  // --- Logging System ---
  function addLog(tag, msg, tagClass = "info") {
    logCounter++;
    const now = new Date();
    const time = now.toLocaleTimeString("fr-FR", { hour12: false }) + "." + String(now.getMilliseconds()).padStart(3, "0");
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-tag ${tagClass}">[${tag}]</span><span class="log-msg">${msg}</span>`;
    logEntries.appendChild(entry);
    logCount.textContent = logCounter;
    logBody.scrollTop = logBody.scrollHeight;
    while (logEntries.children.length > 500) logEntries.removeChild(logEntries.firstChild);
  }

  logToggle.addEventListener("click", () => {
    logBody.classList.toggle("collapsed");
    logChevron.classList.toggle("collapsed");
  });
  
  logClearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    logEntries.innerHTML = "";
    logCounter = 0;
    logCount.textContent = "0";
  });

  // --- Utility Functions ---
  function dataViewToHex(dv) {
    const b = [];
    for (let i = 0; i < dv.byteLength; i++) b.push(dv.getUint8(i).toString(16).toUpperCase().padStart(2, "0"));
    return b.join(":");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
  }

  function rssiToSignal(rssi) {
    if (rssi === undefined || rssi === null) return { label: "N/A", bars: 0 };
    if (rssi >= -50) return { label: "Excellent", bars: 4 };
    if (rssi >= -65) return { label: "Bon", bars: 3 };
    if (rssi >= -80) return { label: "Moyen", bars: 2 };
    return { label: "Faible", bars: 1 };
  }

  function signalBarsHtml(bars) {
    let h = '<span class="signal-bars">';
    for (let i = 1; i <= 4; i++) h += `<span class="signal-bar ${i <= bars ? 'active' : ''}"></span>`;
    return h + '</span>';
  }

  function isFlipperByName(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes("flipper") || n.startsWith("flip");
  }

  function estimateDistance(rssi) {
    if (rssi === undefined || rssi === null) return null;
    const txPower = -59;
    const pathLoss = 2.0;
    const distance = Math.pow(10, (txPower - rssi) / (10 * pathLoss));
    return distance.toFixed(1);
  }

  // --- UI Components ---
  function createResultCard(device, isFlipper) {
    const card = document.createElement("div");
    card.className = `result-card ${isFlipper ? 'flipper-featured' : ''}`;
    card.setAttribute("data-device-id", device.id);
    const signal = rssiToSignal(device.rssi);
    const rssiText = device.rssi !== undefined && device.rssi !== null ? `${device.rssi} dBm` : "N/A";
    const distance = estimateDistance(device.rssi);
    
    if (isFlipper) {
      card.innerHTML = `
        <div class="flipper-featured-glow"></div>
        <div class="flipper-scanline"></div>
        <div class="result-icon-wrap flipper-detected">
          <span class="material-symbols-outlined">phishing</span>
        </div>
        <div class="result-info">
          <div class="flipper-header">
            <p class="result-name is-flipper">${escapeHtml(device.name || "FLIPPER ZERO")}</p>
            <span class="result-badge flipper">
              <span class="material-symbols-outlined" style="font-size:12px">verified</span>
              DETECTED
            </span>
          </div>
          <p class="result-details">HARDWARE_ID: ${escapeHtml(device.id)}</p>
          <div class="flipper-metrics">
            <div class="metric-item">
              <span class="metric-label">SIGNAL</span>
              <div class="metric-value">
                ${signalBarsHtml(signal.bars)}
                <span class="metric-text">${signal.label} (${rssiText})</span>
              </div>
            </div>
            <div class="metric-item">
              <span class="metric-label">PORTÉE ESTIMÉE</span>
              <div class="metric-value">
                <span class="material-symbols-outlined" style="font-size:16px; color:var(--primary)">straighten</span>
                <span class="metric-text distance-val distance-highlight">${distance ? 'env. ' + distance + 'm' : 'calcul...'}</span>
              </div>
              <div class="range-bar-bg">
                <div class="range-bar-fill" style="width: ${distance ? Math.min(100, (distance / 20) * 100) + '%' : '0%'}"></div>
              </div>
            </div>
          </div>
          <p class="flipper-env-hint">Estimation basée sur un scan à l'air libre (n=2.0)</p>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="result-icon-wrap">
          <span class="material-symbols-outlined">bluetooth</span>
        </div>
        <div class="result-info">
          <p class="result-name">${escapeHtml(device.name || "Sans nom")}</p>
          <p class="result-details">ID: ${escapeHtml(device.id.substring(0, 20))}</p>
          <div class="result-rssi">${signalBarsHtml(signal.bars)}<span>${signal.label} (${rssiText})</span></div>
        </div>
        <span class="result-badge unknown">
          <span class="material-symbols-outlined" style="font-size:12px">device_unknown</span>
          APPAREIL BLE
        </span>`;
    }
    return card;
  }

  function updateDeviceRssi(deviceId, rssi) {
    const card = document.querySelector(`[data-device-id="${CSS.escape(deviceId)}"]`);
    if (!card) return;
    const signal = rssiToSignal(rssi);
    const distance = estimateDistance(rssi);

    if (card.classList.contains("flipper-featured")) {
      const signalEl = card.querySelector(".metric-item:first-child .metric-text");
      const signalBars = card.querySelector(".metric-item:first-child .signal-bars");
      const distanceEl = card.querySelector(".distance-val");
      const rangeFill = card.querySelector(".range-bar-fill");

      if (signalEl) signalEl.textContent = `${signal.label} (${rssi} dBm)`;
      if (signalBars) signalBars.innerHTML = signalBarsHtml(signal.bars).replace('<span class="signal-bars">', '').replace('</span>', '');
      if (distanceEl) distanceEl.textContent = distance ? 'env. ' + distance + 'm' : 'calcul...';
      if (rangeFill && distance) {
        rangeFill.style.width = Math.min(100, (distance / 20) * 100) + "%";
      }
    } else {
      const el = card.querySelector(".result-rssi");
      if (el) el.innerHTML = `${signalBarsHtml(signal.bars)}<span>${signal.label} (${rssi} dBm)</span>`;
    }
  }

  // --- UI Reset/Finish ---
  function resetUI(modeName) {
    detectedDevices = [];
    advertCounter = 0;
    flipperResults.innerHTML = "";
    resultsList.innerHTML = "";
    otherDevicesWrapper.classList.add("hidden");
    otherDevicesCount.textContent = "0";
    noResults.classList.add("hidden");
    scanAgainBtn.classList.add("hidden");
    fallbackScanBtn.classList.add("hidden");
    
    logSection.classList.remove("hidden");
    logEntries.innerHTML = "";
    logCount.textContent = "0";
    logCounter = 0;
    logBody.classList.remove("collapsed");
    logChevron.classList.remove("collapsed");
    
    scanBtn.classList.add("scanning");
    scanBtnLabel.textContent = "SCAN EN COURS...";
    
    scannerSection.classList.remove("hidden");
    radarContainer.classList.remove("hidden");
    statusDot.className = "status-dot";
    statusText.textContent = modeName;
    
    setTimeout(() => scannerSection.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    timerDisplay.classList.add("hidden");
  }

  function stopScan() {
    if (currentScan) {
      try { currentScan.stop(); } catch(e) {}
      currentScan = null;
    }
    if (advertHandler) {
      navigator.bluetooth.removeEventListener("advertisementreceived", advertHandler);
      advertHandler = null;
    }
    stopCountdown();
  }

  function finishScanUI() {
    stopScan();
    isScanning = false;
    scanBtn.classList.remove("scanning");
    scanBtnLabel.textContent = "LANCER LE SCAN";
    scanBtnIcon.textContent = "bluetooth_searching";
    radarContainer.classList.add("hidden");
    
    scanAgainBtn.classList.remove("hidden");
    fallbackScanBtn.classList.remove("hidden");

    const fc = detectedDevices.filter(d => d.isFlipper).length;
    if (detectedDevices.length === 0) {
      noResults.classList.remove("hidden");
      statusDot.className = "status-dot alert";
      statusText.textContent = "AUCUN RÉSULTAT";
    } else if (fc > 0) {
      statusDot.className = "status-dot done";
      statusText.textContent = `✓ ${fc} FLIPPER(S) / ${detectedDevices.length} APPAREILS`;
    } else {
      statusDot.className = "status-dot done";
      statusText.textContent = `${detectedDevices.length} APPAREILS — AUCUN FLIPPER`;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MODE 1: PASSIVE SCAN (requestLEScan)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function startPassiveScan() {
    if (isScanning) return;
    isScanning = true;
    resetUI("SCAN PASSIF EN COURS...");
    
    addLog("SYS", "Démarrage du scan passif BLE (Web Bluetooth)...", "info");
    addLog("USER", "Si une popup Chrome s'affiche, cliquez sur 'Autoriser'.", "warn");

    try {
      currentScan = await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
      addLog("BLE", "Scan passif autorisé et actif ✓", "info");

      advertHandler = (event) => {
        advertCounter++;
        const deviceId = event.device.id;
        const name = event.device.name || event.name || "";
        const rssi = event.rssi;
        const isNew = !detectedDevices.some(d => d.device.id === deviceId);
        
        let isFlipper = isFlipperByName(name);
        
        // Check manufacturer data
        if (event.manufacturerData && event.manufacturerData.size > 0) {
          for (const [cid, dv] of event.manufacturerData) {
            if (cid === FLIPPER_COMPANY_ID) isFlipper = true;
            if (isNew) {
              const hex = dataViewToHex(dv);
              addLog("MFR", `Company: <strong>0x${cid.toString(16).toUpperCase()}</strong> | <span class="hl">${hex}</span>`, "data");
            }
          }
        }

        if (isNew) {
          detectedDevices.push({ device: { id: deviceId, name, rssi }, isFlipper });
          
          const card = createResultCard({ id: deviceId, name, rssi }, isFlipper);
          if (isFlipper) {
            flipperResults.appendChild(card);
          } else {
            resultsList.appendChild(card);
            otherDevicesWrapper.classList.remove("hidden");
            const otherCount = detectedDevices.filter(d => !d.isFlipper).length;
            otherDevicesCount.textContent = otherCount;
          }
          
          addLog(isFlipper ? "MATCH" : "NEW", `Detecté: <strong>${escapeHtml(name || 'Sans nom')}</strong> (${deviceId.substring(0,10)})`, isFlipper ? "flipper" : "new");
        } else {
          const d = detectedDevices.find(d => d.device.id === deviceId);
          if (d) d.device.rssi = rssi;
          updateDeviceRssi(deviceId, rssi);
        }

        const fc = detectedDevices.filter(d => d.isFlipper).length;
        statusText.textContent = fc > 0
          ? `⚠ ${fc} FLIPPER(S) — ${detectedDevices.length} appareils`
          : `${detectedDevices.length} APPAREIL(S) DÉTECTÉ(S)`;
        if (fc > 0) statusDot.className = "status-dot done";
      };

      navigator.bluetooth.addEventListener("advertisementreceived", advertHandler);

      let timeLeft = SCAN_DURATION;
      timerDisplay.classList.remove("hidden");
      timerDisplay.textContent = `${timeLeft}s`;
      
      countdownInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
          addLog("SYS", `Scan terminé — ${advertCounter} paquets reçus.`, "info");
          finishScanUI();
        }
      }, 1000);

    } catch (err) {
      addLog("ERR", `Erreur Scan Passif: ${err.message}`, "error");
      if (err.name === "NotAllowedError") {
        addLog("WARN", "Permission refusée. Utilisez le SÉLECTEUR CHROME en fallback.", "warn");
      }
      finishScanUI();
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MODE 2: CLASSIC PICKER (requestDevice)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function startClassicScan() {
    if (isScanning) stopScan();
    resetUI("SÉLECTION APPAREIL...");
    radarContainer.classList.add("hidden"); // Pas de radar pour le sélecteur
    
    addLog("SYS", "Ouverture du sélecteur Chrome classique...", "info");
    addLog("USER", "Une popup Chrome devrait apparaître au centre de l'écran.", "warn");

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["generic_access"]
      });
      
      const isFlipper = isFlipperByName(device.name);
      
      if (!detectedDevices.some(d => d.device.id === device.id)) {
        detectedDevices.push({ device: { id: device.id, name: device.name, rssi: null }, isFlipper });
        const card = createResultCard({ id: device.id, name: device.name, rssi: null }, isFlipper);
        if (isFlipper) {
          flipperResults.appendChild(card);
        } else {
          resultsList.appendChild(card);
          otherDevicesWrapper.classList.remove("hidden");
          const otherCount = detectedDevices.filter(d => !d.isFlipper).length;
          otherDevicesCount.textContent = otherCount;
        }
      }
      
      addLog(isFlipper ? "MATCH" : "NEW", `Sélectionné: <strong>${escapeHtml(device.name || 'Sans nom')}</strong>`, isFlipper ? "flipper" : "new");
      
      noResults.classList.add("hidden");
      statusDot.className = "status-dot done";
      statusText.textContent = "APPAREIL SÉLECTIONNÉ";
      
    } catch (err) {
      addLog("ERR", `Sélecteur annulé ou erreur: ${err.message}`, "error");
    } finally {
      finishScanUI();
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INIT & DIAGNOSTICS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function checkSystem() {
    const diagSecure = document.querySelector("#diagSecure .diag-value");
    const diagBluetooth = document.querySelector("#diagBluetooth .diag-value");
    const diagScanning = document.querySelector("#diagScanning .diag-value");
    const diagAgent = document.querySelector("#diagAgent .diag-value");

    const isIPhone = /iPhone/i.test(navigator.userAgent);

    // Browser Detection
    let browserName = navigator.userAgent.split(" ").pop();
    if (navigator.userAgent.includes("Chrome")) browserName = "Chrome ✓";
    if (navigator.userAgent.includes("Edg/")) browserName = "Edge ✓";
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      browserName += " (Mobile)";
    }
    diagAgent.textContent = browserName;

    // Secure Context
    if (window.isSecureContext) {
      diagSecure.textContent = "SECURE / ONLINE";
      diagSecure.className = "diag-value online";
    } else {
      diagSecure.textContent = "UNSECURE / ERROR";
      diagSecure.className = "diag-value offline";
    }

    if (isIPhone) {
      iphoneWarning.classList.remove("hidden");
      browserWarning.classList.add("hidden");
      diagBluetooth.textContent = "IOS_LIMITATION";
      diagBluetooth.className = "diag-value error";
      scanBtn.disabled = true;
      scanBtnLabel.textContent = "BLUEFY REQUIS";
      return;
    }

    // Bluetooth Support
    if (!navigator.bluetooth) {
      diagBluetooth.textContent = "NOT_SUPPORTED";
      diagBluetooth.className = "diag-value offline";
      browserWarning.classList.remove("hidden");
      scanBtn.disabled = true;
      return;
    } else {
      try {
        const available = await navigator.bluetooth.getAvailability();
        diagBluetooth.textContent = available ? "ADAPTER_READY" : "ADAPTER_OFFLINE";
        diagBluetooth.className = available ? "diag-value online" : "diag-value offline";
      } catch (e) {
        diagBluetooth.textContent = "CHECK_FAILED";
        diagBluetooth.className = "diag-value error";
      }
    }

    // Scanning API (Passive)
    if (typeof navigator.bluetooth.requestLEScan === "function") {
      diagScanning.textContent = "API_AVAILABLE";
      diagScanning.className = "diag-value online";
    } else {
      diagScanning.textContent = "FLAG_MISSING";
      diagScanning.className = "diag-value error";
      flagWarning.classList.remove("hidden");
    }

    // Enable main button
    scanBtn.disabled = false;
    scanBtnLabel.textContent = "LANCER LE SCAN";
  }

  // --- Event Listeners ---
  scanBtn.addEventListener("click", startPassiveScan);
  
  scanAgainBtn.addEventListener("click", () => {
    noResults.querySelector(".no-results-text").textContent = "Aucun Flipper Zero détecté à proximité.";
    noResults.querySelector(".no-results-hint").textContent = "Assurez-vous que le Bluetooth du Flipper est actif.";
    startPassiveScan();
  });
  
  fallbackScanBtn.addEventListener("click", startClassicScan);

  const copyFlagBtn = document.getElementById("copyFlagBtn");
  if (copyFlagBtn) {
    copyFlagBtn.addEventListener("click", () => {
      navigator.clipboard.writeText("chrome://flags/#enable-experimental-web-platform-features").then(() => {
        copyFlagBtn.querySelector(".copy-label").textContent = "COPIÉ !";
        setTimeout(() => { copyFlagBtn.querySelector(".copy-label").textContent = "COPIER LE LIEN"; }, 2000);
      });
    });
  }

  // Boot
  checkSystem();

})();
