// ---------- Element References ----------
const actionSelect = document.getElementById("action");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const dynamicArea = document.getElementById("dynamicArea");
const previewBox = document.getElementById("previewBox");
const addToReportBtn = document.getElementById("addToReport");
const detailedReport = document.getElementById("detailedReport");
const summaryReport = document.getElementById("summaryReport");

// ---------- Data ----------
let reportEntries = { company: [], study: [] };
let summaryCounts = {
  company: { edited: 0, deleted: 0, added: 0, merged: 0, unmerged: 0 },
  study: { edited: 0, deleted: 0, added: 0, merged: 0, unmerged: 0 }
};
let mergeCompanies = [];
let logEntries = [];
let savedReports = JSON.parse(localStorage.getItem("savedReports") || "[]");
let reasonOptions = ["University", "Hospital", "Clinical Research Site"];
let selectedReasons = [];
let multiDropdownOpen = false;

// ---------- Load Saved Reports from Firebase (always visible + sorted) ----------
async function renderSavedReports() {
  const { collection, getDocs, deleteDoc, doc } = window.firestoreFns;
  const db = window.firestoreDB;
  const savedContainer = document.getElementById("savedReports");

  // Keep the header, don’t wipe out the container
  savedContainer.innerHTML = "<h4>Saved Reports</h4>";

  try {
    const querySnapshot = await getDocs(collection(db, "reports"));

    // If empty, still show the section but with message
    if (querySnapshot.empty) {
      savedContainer.innerHTML += "<p style='color:#777; font-size:14px;'>No saved reports yet.</p>";
      return;
    }

    // Convert docs to array for sorting
    const reports = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    // Sort by timestamp descending (latest first)
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Render sorted results
    const listWrapper = document.createElement("div");
    listWrapper.classList.add("saved-report-list");

    reports.forEach((data) => {
      const item = document.createElement("div");
      item.classList.add("saved-report-container");

      const formattedDate = new Date(data.timestamp).toLocaleString();
      const timerDisplay = data.timer ? `⏱ ${data.timer.formattedTime}` : "";

      item.innerHTML = `
        <a href="#" class="saved-report" onclick="loadReport('${data.id}')">
          ${formattedDate}
        </a>
        <span class="timer-tag">${timerDisplay}</span>
        <button class="delete-btn" onclick="deleteReport('${data.id}')">🗑️</button>
      `;

      listWrapper.appendChild(item);
    });

    savedContainer.appendChild(listWrapper);
  } catch (err) {
    console.error("Error loading reports:", err);
    showNotif("⚠️ Failed to load reports from Firebase.");
  }
}



// ---------- Load Individual Report (includes Timer) ----------
async function loadReport(id) {
  const { getDocs, collection } = window.firestoreFns;
  const db = window.firestoreDB;
  const querySnapshot = await getDocs(collection(db, "reports"));
  const found = querySnapshot.docs.find((d) => d.id === id);
  if (!found) return;

  const data = found.data();
  document.getElementById("detailedReport").value = data.detailed || "";
  document.getElementById("summaryReport").value = data.summary || "";
  showNotif("📄 Report loaded from Firebase!");

  // Restore timer if exists
  if (data.timer) {
    elapsedSeconds = data.timer.elapsedSeconds || 0;
    isPaused = data.timer.isPaused || false;

    updateTimerDisplay();

    // Stop existing interval before restoring
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    // Resume only if not paused
    if (!isPaused) {
      timerInterval = setInterval(() => {
        elapsedSeconds++;
        updateTimerDisplay();
      }, 1000);
    }

    pauseBtn.textContent = isPaused ? "▶️ Resume" : "⏸️ Pause";
  }
}


// ---------- Delete Report ----------
async function deleteReport(id) {
  const { deleteDoc, doc } = window.firestoreFns;
  const db = window.firestoreDB;
  try {
    await deleteDoc(doc(db, "reports", id));
    showNotif("🗑️ Report deleted from Firebase!");
    renderSavedReports();
  } catch (err) {
    console.error("Delete failed:", err);
    showNotif("⚠️ Failed to delete report.");
  }
}

// ---------- Dropdown Data ----------
function getCategories(type) {
  if (type === "company") {
    return [
      { value: "basic", label: "Basic Info" },
      { value: "location", label: "Location Details" },
      { value: "social", label: "Social Media" },
      { value: "advanced", label: "Advanced" }
    ];
  }
  if (type === "study") {
    return [
      { value: "basic", label: "Basic Info" },
      { value: "clinical", label: "Clinical Details" },
      { value: "source", label: "Source & Tracking" },
      { value: "advanced", label: "Advanced" }
    ];
  }
  return [];
}

function getSubCategories(category, type) {
  if (type === "company") {
    switch (category) {
      case "basic": return ["Company Name", "Website", "Industry", "Company Size"];
      case "location": return ["Location Name", "Street Address", "Address Line 2", "Country", "Continent", "Postal Code"];
      case "social": return ["LinkedIn URL", "Facebook URL", "Twitter URL"];
      case "advanced": return ["Email Pattern", "Company Synonyms", "Is Target Company"];
      default: return [];
    }
  }
  if (type === "study") {
    switch (category) {
      case "basic": return ["Title", "Status", "Company", "Company Type", "Official Title", "Description"];
      case "clinical": return ["NCT ID", "Trial ID", "Phase", "Study Type", "Drug Name", "Indication", "Therapeutic Area", "Target Enrollment", "Start Date", "End Date", "Conditions"];
      case "source": return ["Source Type", "Source URL", "Contacts", "Discovery Status", "Discovery Attempts"];
      case "advanced": return ["Scrape Data ID", "Search Result Item ID", "Last Discovery Attempt"];
      default: return [];
    }
  }
  return [];
}

// ---------- Rendering Dynamic Fields ----------
function refreshCategoryDropdown() {
  const type = typeSelect.value;
  const categories = getCategories(type);
  categorySelect.innerHTML = "<option value=''>Select Category</option>";
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.value;
    option.textContent = cat.label;
    categorySelect.appendChild(option);
  });
}

function createSubCategoryDropdown() {
  const subOptions = getSubCategories(categorySelect.value, typeSelect.value);
  let html = `<select id="subCategory">`;
  html += `<option value="">Select Sub Category</option>`;
  subOptions.forEach(opt => {
    html += `<option>${opt}</option>`;
  });
  html += `</select>`;
  return html;
}

function renderDynamicFields() {
  const action = actionSelect.value;
  let html = "";
  const subCategory = createSubCategoryDropdown();

  if (action === "edited") {
    categorySelect.disabled = false;
    html = `
      <input type="text" id="name" placeholder="Name"> 
      ${subCategory} was edited from 
      <input type="text" id="fromValue" placeholder="From Value"> to 
      <input type="text" id="toValue" placeholder="To Value">
    `;
  }

  // ---------- Deleted Action ----------
  else if (action === "deleted") {
  categorySelect.disabled = true;
  html = `
    <div class="deleted-inline">
      <input type="text" id="name" placeholder="Name"> 
      <span>was deleted.</span>
      <label class="reason-label">Reason<span class="required">*</span>:</label>
      <div class="multi-dropdown inline-dropdown">
        <div class="multi-select" id="multiSelect">
          <span id="selectedCount">Select or search reason</span>
          <span class="arrow">⏷</span>
        </div>
        <div class="multi-content" id="multiContent">
          <input type="text" id="multiSearch" placeholder="Search or add..." oninput="filterMultiOptions()">
          <div id="multiOptions" class="multi-options"></div>
        </div>
      </div>
    </div>
  `;

    dynamicArea.innerHTML = html;
    renderMultiOptions();

    // Attach click listener
    const multiSelect = document.getElementById("multiSelect");
    if (multiSelect) {
      multiSelect.addEventListener("click", toggleMultiDropdown);
    }
    return; // stop here
  }

  else if (action === "added") {
    categorySelect.disabled = true;
    html = `<input type="text" id="name" placeholder="Name"> was added`;
  }

  else if (action === "merged" && typeSelect.value === "company") {
    categorySelect.disabled = true;
    mergeCompanies = [];
    html = `
      <label>Target Company:</label>
      <input type="text" id="targetCompany" placeholder="Target Company"><br><br>
      
      <label>To Merge with:</label>
      <input type="text" id="mergeInput" placeholder="Company to merge">
      <button type="button" class="add-btn" onclick="addMergeCompany()">✚</button>
      <ul id="mergeList" class="merge-list"></ul>
    `;
  }

  else if (action === "unmerged" && typeSelect.value === "company") {
    categorySelect.disabled = true;
    html = `
      <label>Company 1:</label>
      <input type="text" id="company1" placeholder="Company 1">
      <br><br>
      <label>Company 2:</label>
      <input type="text" id="company2" placeholder="Company 2">
    `;
  }

  dynamicArea.innerHTML = html;
  attachPreviewListeners();
}

// ---------- Merge Companies Logic ----------
function addMergeCompany() {
  const mergeInput = document.getElementById("mergeInput");
  const mergeList = document.getElementById("mergeList");
  const companyToAdd = mergeInput.value.trim();

  if (!companyToAdd) {
    showNotif("⚠️ Please enter a company name to merge.");
    return;
  }

  // Prevent duplicate entries
  if (mergeCompanies.includes(companyToAdd)) {
    showNotif("⚠️ This company is already in the merge list.");
    mergeInput.value = "";
    return;
  }

  // Add to list and refresh display
  mergeCompanies.push(companyToAdd);
  mergeInput.value = "";

  const listItem = document.createElement("li");
  listItem.textContent = companyToAdd;

  // Add a small remove button for convenience
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "✖";
  removeBtn.className = "remove-option";
  removeBtn.title = "Remove this company";
  removeBtn.style.marginLeft = "6px";
  removeBtn.addEventListener("click", () => {
    mergeCompanies = mergeCompanies.filter(c => c !== companyToAdd);
    listItem.remove();
  });

  listItem.appendChild(removeBtn);
  mergeList.appendChild(listItem);

  // Update the live preview
  updatePreview();
}


// ---------- Multi-dropdown Logic ----------
function toggleMultiDropdown() {
  const content = document.getElementById("multiContent");
  const select = document.getElementById("multiSelect");
  if (!content || !select) return;

  multiDropdownOpen = !multiDropdownOpen;
  content.style.display = multiDropdownOpen ? "block" : "none";

  // rotate arrow on open
  if (multiDropdownOpen) {
    select.classList.add("open");
    renderMultiOptions();
    document.getElementById("multiSearch").focus();
  } else {
    select.classList.remove("open");
  }
}

function renderMultiOptions(filtered = reasonOptions) {
  const list = document.getElementById("multiOptions");
  if (!list) return;
  list.innerHTML = "";

  const searchValue = document.getElementById("multiSearch")?.value.trim().toLowerCase() || "";

  // Add new option if not found
  const searchInput = document.getElementById("multiSearch");
  const typedValue = searchInput?.value.trim() || "";

  if (
    typedValue &&
    !reasonOptions.map(r => r.toLowerCase()).includes(typedValue.toLowerCase())
  ) {
    const addItem = document.createElement("div");
    addItem.className = "multi-option add-new";
    addItem.textContent = `+ Add "${typedValue}"`; // preserves typed case
    addItem.onclick = (e) => {
      e.stopPropagation(); // prevent closing
      addNewMultiOption(typedValue, false); // false = keep dropdown open
    };
    list.appendChild(addItem);
  }

  // Render checkboxes + remove buttons
  filtered.forEach(opt => {
    const div = document.createElement("div");
    div.className = "multi-option";
    div.innerHTML = `
      <label>
        <input type="checkbox" value="${opt}" ${selectedReasons.includes(opt) ? "checked" : ""}>
        ${opt}
      </label>
      <button class="remove-option" title="Remove ${opt}">✖</button>
    `;

    div.querySelector("input").addEventListener("change", (e) => {
      handleMultiSelection(e.target.value, e.target.checked);
    });

    div.querySelector(".remove-option").addEventListener("click", (e) => {
      e.stopPropagation();
      removeReasonOption(opt);
    });

    list.appendChild(div);
  });
}

function addNewMultiOption(value, closeAfterAdd = true) {
  const searchInput = document.getElementById("multiSearch");
  const originalText = searchInput?.value.trim() || value;

  // check for duplicates (case-insensitive)
  const alreadyExists = reasonOptions.some(
    r => r.toLowerCase() === originalText.toLowerCase()
  );

  if (!alreadyExists) {
    // Add with the exact text user typed
    reasonOptions.unshift(originalText);
  }

  // auto-select it
  if (!selectedReasons.includes(originalText)) {
    selectedReasons.push(originalText);
  }

  // clear and re-render
  if (searchInput) searchInput.value = "";
  renderMultiOptions(reasonOptions);
  updateMultiSelectedLabel();
  updatePreview();

  // keep dropdown open if requested
  if (!closeAfterAdd) {
    const content = document.getElementById("multiContent");
    content.style.display = "block";
    multiDropdownOpen = true;
  }
}

function handleMultiSelection(value, checked) {
  if (checked) {
    if (!selectedReasons.includes(value)) selectedReasons.push(value);
  } else {
    selectedReasons = selectedReasons.filter(r => r !== value);
  }
  updateMultiSelectedLabel();
  updatePreview();
}

function removeReasonOption(value) {
  reasonOptions = reasonOptions.filter(opt => opt !== value);
  selectedReasons = selectedReasons.filter(r => r !== value);
  renderMultiOptions(reasonOptions);
  updateMultiSelectedLabel();
  updatePreview();
}

function updateMultiSelectedLabel() {
  const label = document.getElementById("selectedCount");
  if (selectedReasons.length === 0) label.textContent = "Select or search reason";
  else label.textContent = `${selectedReasons.length} Selected`;
}

function filterMultiOptions() {
  const search = document.getElementById("multiSearch").value.toLowerCase();
  const filtered = reasonOptions.filter(opt => opt.toLowerCase().includes(search));
  renderMultiOptions(filtered);
}

// ---------- Live Preview ----------
function attachPreviewListeners() {
  const inputs = dynamicArea.querySelectorAll("input, select");
  inputs.forEach(el => {
    el.addEventListener("input", updatePreview);
    el.addEventListener("change", updatePreview);
  });
}

function updatePreview() {
  const action = actionSelect.value;
  const name = document.getElementById("name")?.value || "[Name]";
  const subCategory = document.getElementById("subCategory")?.value || "[Sub Category]";
  let text = "";

  if (action === "edited") {
    const fromValue = document.getElementById("fromValue")?.value || "[From]";
    const toValue = document.getElementById("toValue")?.value || "[To]";
    text = `${name} [${subCategory}] was edited from "${fromValue}" to "${toValue}"`;
  } 
  else if (action === "deleted") {
    const reasonsText = selectedReasons.length ? selectedReasons.join(", ") : "[Reason]";
    text = `${name} was deleted (Reason: ${reasonsText})`;
  } 
  else if (action === "added") {
    text = `${name} was added`;
  } 
  else if (action === "merged" && typeSelect.value === "company") {
    const targetCompany = document.getElementById("targetCompany")?.value || "[Target Company]";
    text = `Companies: ${mergeCompanies.join(", ")} were merged to ${targetCompany}`;
  } 
  else if (action === "unmerged" && typeSelect.value === "company") {
    const company1 = document.getElementById("company1")?.value || "[Company 1]";
    const company2 = document.getElementById("company2")?.value || "[Company 2]";
    text = `${company1} and ${company2} were unmerged`;
  }

  previewBox.textContent = text;
  return text;
}

// ---------- Add to Report ----------
addToReportBtn.addEventListener("click", () => {
  let valid = true;

  typeSelect.classList.remove("flash-error");
  categorySelect.classList.remove("flash-error");
  actionSelect.classList.remove("flash-error");

  if (!typeSelect.value) {
    showNotif("⛔ Type is required.");
    typeSelect.classList.add("flash-error");
    valid = false;
  }

  if (typeSelect.value && !categorySelect.value && !actionSelect.value) {
    showNotif("⛔ Add a Category and Action first before adding to report.");
    categorySelect.classList.add("flash-error");
    actionSelect.classList.add("flash-error");
    valid = false;
  }

  if (!valid) return;

  const type = typeSelect.value;
  const action = actionSelect.value;
  const category = categorySelect.value || "N/A";
  const subCategory = document.getElementById("subCategory")?.value || "N/A";
  const name = document.getElementById("name")?.value || "N/A";
  const today = new Date().toISOString().split("T")[0];

  let details = "N/A";
  if (action === "edited") {
    const from = document.getElementById("fromValue")?.value || "[From]";
    const to = document.getElementById("toValue")?.value || "[To]";
    details = `"${from}" → "${to}"`;
  } 
  else if (action === "deleted") {
    details = `Reason: ${selectedReasons.join(", ") || "unspecified"}`;
  } 
  else if (action === "merged" && type === "company") {
    const targetCompany = document.getElementById("targetCompany")?.value || "[Target]";
    details = `Merged into ${targetCompany}`;
  } 
  else if (action === "unmerged" && type === "company") {
    const company1 = document.getElementById("company1")?.value || "[Company 1]";
    const company2 = document.getElementById("company2")?.value || "[Company 2]";
    details = `${company1} and ${company2} were unmerged`;
  }

  const entry = updatePreview();
  if (reportEntries[type].includes(entry)) {
    showNotif("⛔ Entry already added.");
    return;
  }

  reportEntries[type].push(entry);
  summaryCounts[type][action] += 1;
  updateReports();
});

// ---------- Update Reports ----------
function updateReports() {
  let detailedText = "";
  if (reportEntries.company.length) {
    detailedText += "Companies:\n" + reportEntries.company.join("\n") + "\n\n";
  }
  if (reportEntries.study.length) {
    detailedText += "Studies:\n" + reportEntries.study.join("\n");
  }
  detailedReport.value = detailedText.trim();

  let summaryText = "Daily Summary:\n";
  if (summaryCounts.company.edited || summaryCounts.company.added || summaryCounts.company.deleted || summaryCounts.company.merged || summaryCounts.company.unmerged) {
    summaryText += "Companies:\n";
    if (summaryCounts.company.edited) summaryText += `- ${summaryCounts.company.edited} edited\n`;
    if (summaryCounts.company.deleted) summaryText += `- ${summaryCounts.company.deleted} deleted\n`;
    if (summaryCounts.company.added) summaryText += `- ${summaryCounts.company.added} added\n`;
    if (summaryCounts.company.merged) summaryText += `- ${summaryCounts.company.merged} merged\n`;
    if (summaryCounts.company.unmerged) summaryText += `- ${summaryCounts.company.unmerged} unmerged\n`;
  }
  summaryReport.value = summaryText.trim();
}

// ---------- Work Timer (Emoji UI + Persistence) ----------
let timerInterval;
let elapsedSeconds = 0;
let isPaused = true;

const timerDisplay = document.getElementById("timer-display");
const toggleBtn = document.getElementById("toggleTimer");
const resetBtn = document.getElementById("resetTimer");

function formatTime(sec) {
  const hrs = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const secs = String(sec % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(elapsedSeconds);
  document.title = `⏱️ ${formatTime(elapsedSeconds)} - Data Cleanup Report Generator`;

  localStorage.setItem(
    "workTimer",
    JSON.stringify({ elapsedSeconds, isPaused, lastUpdated: Date.now() })
  );
}

function toggleTimer() {
  if (isPaused) {
    // start
    isPaused = false;
    toggleBtn.textContent = "❚❚";
    timerInterval = setInterval(() => {
      if (!isPaused) {
        elapsedSeconds++;
        updateTimerDisplay();
      }
    }, 1000);
  } else {
    // pause
    isPaused = true;
    toggleBtn.textContent = "▸";
    clearInterval(timerInterval);
  }
  updateTimerDisplay();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  elapsedSeconds = 0;
  isPaused = true;
  toggleBtn.textContent = "▸";
  updateTimerDisplay();
  document.title = "Data Cleanup Report Generator";
  localStorage.removeItem("workTimer");
}

// ---------- Restore from LocalStorage ----------
function restoreTimer() {
  const saved = JSON.parse(localStorage.getItem("workTimer"));
  if (!saved) return;

  elapsedSeconds = saved.elapsedSeconds || 0;
  isPaused = saved.isPaused ?? true;

  if (!isPaused && saved.lastUpdated) {
    const diff = Math.floor((Date.now() - saved.lastUpdated) / 1000);
    elapsedSeconds += diff;

    timerInterval = setInterval(() => {
      elapsedSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  toggleBtn.textContent = isPaused ? "▸" : "❚❚";
  updateTimerDisplay();
}

toggleBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click", resetTimer);

restoreTimer();



// ---------- Save Daily Report (Firebase + Timer + Auto Reset) ----------
async function saveDailyReport() {
  const { collection, doc, setDoc } = window.firestoreFns;
  const db = window.firestoreDB;

  const detailed = document.getElementById("detailedReport").value.trim();
  const summary = document.getElementById("summaryReport").value.trim();

  if (!detailed && !summary) {
    showNotif("⚠️ Nothing to save. Add data first.");
    return;
  }

  // Create "Saving..." notification
  const savingNotif = document.createElement("div");
  savingNotif.className = "notification info saving";
  savingNotif.innerHTML = `
    <div class="content">
      <div class="title">💾 Saving Report...</div>
      <div class="message">Please wait while your report is being uploaded.</div>
    </div>
  `;
  document.getElementById("notification-container").appendChild(savingNotif);

  // Format readable timestamp ID (YYYYMMDD_HHMMSS)
  const now = new Date();
  const timestampId = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 15);

  // Save timer data
  const timerData = {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    isPaused,
  };

  const reportData = {
    detailed: detailed.replace(/\n/g, "\n"),
    summary: summary.replace(/\n/g, "\n"),
    timer: timerData,
    timestamp: now.toISOString(),
  };

  try {
    const docRef = doc(db, "reports", timestampId);
    await setDoc(docRef, reportData);

    savingNotif.remove();
    showNotif(`✅ Report saved as "${timestampId}" (Timer: ${timerData.formattedTime})`);

    // Refresh saved reports
    renderSavedReports();

    // 🔁 Reset the timer after save
    stopTimer();
  } catch (err) {
    console.error("Error saving report:", err);
    savingNotif.querySelector(".title").textContent = "❌ Failed to save report";
    savingNotif.querySelector(".message").textContent = "There was a problem saving to Firebase.";
    savingNotif.style.borderLeftColor = "#d9534f";
    setTimeout(() => savingNotif.remove(), 4000);
  }
}



// ---------- Utilities ----------
function showNotif(message) {
  const container = document.getElementById("notification-container");
  const notif = document.createElement("div");
  notif.className = "notification info";
  notif.innerHTML = `
    <div class="content">
      <div class="title">🔔 NOTICE 🔔</div>
      <div class="message">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()">✖</button>
  `;
  container.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => notif.remove(), 500);
  }, 4500);
}

// ---------- Reset Button ----------
document.getElementById("resetEntry").addEventListener("click", () => {
  typeSelect.value = "";
  categorySelect.innerHTML = "<option value=''>Select Category</option>";
  actionSelect.value = "";
  dynamicArea.innerHTML = "";
  previewBox.textContent = "[Preview will appear here]";

  const typeError = document.getElementById("typeError");
  if (typeError) typeError.textContent = "";
  const reasonError = document.getElementById("reasonError");
  if (reasonError) reasonError.textContent = "";
  const catActMsg = document.getElementById("catActMsg");
  if (catActMsg) catActMsg.textContent = "";
});

// ---------- Quick Tally Counters ----------
let tallyCounts = {
  edited: 0,
  deleted: 0,
  added: 0,
  merged: 0,
  unmerged: 0
};

function changeTally(action, delta) {
  tallyCounts[action] = Math.max(0, tallyCounts[action] + delta); // prevent negative
  document.getElementById(`count-${action}`).textContent = tallyCounts[action];
}

function applyTally() {
  // Reflect tallies into the summaryCounts, no reset
  Object.keys(tallyCounts).forEach(action => {
    summaryCounts.company[action] += tallyCounts[action];
  });
  updateReports();
  showNotif("✅ Tally added to summary report!");
}

function resetTally() {
  showResetModal();
}

function performResetTally() {
  Object.keys(tallyCounts).forEach(action => {
    tallyCounts[action] = 0;
    document.getElementById(`count-${action}`).textContent = 0;
  });
  hideResetModal();
  showNotif("🔄 Counters have been reset.");
}

// ---------- Modern Reset Modal ----------
function showResetModal() {
  document.getElementById("resetModal").style.display = "flex";
}

function hideResetModal() {
  document.getElementById("resetModal").style.display = "none";
}


// ---------- Event Listeners ----------
typeSelect.addEventListener("change", refreshCategoryDropdown);
categorySelect.addEventListener("change", renderDynamicFields);
actionSelect.addEventListener("change", renderDynamicFields);

// ---------- Copy & Clear Buttons ----------
function copyToClipboard(elementId) {
  const textarea = document.getElementById(elementId);
  if (!textarea) return;
  textarea.select();
  textarea.setSelectionRange(0, 99999); // for mobile
  document.execCommand("copy");
  showNotif("✅ Copied to clipboard!");
}

function clearTextarea(elementId) {
  const textarea = document.getElementById(elementId);
  if (!textarea) return;
  textarea.value = "";
  showNotif("🧹 Cleared successfully!");
}

// ---------- Auto-load Saved Reports on Page Load ----------
window.addEventListener("DOMContentLoaded", () => {
  renderSavedReports();
});

// ---------- Expose function globally so HTML can call it ----------
window.saveDailyReport = saveDailyReport;
