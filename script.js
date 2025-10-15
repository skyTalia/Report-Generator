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

// ---------- Load Saved Reports ----------
window.addEventListener("DOMContentLoaded", () => {
  renderSavedReports();
});

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
    showError("⛔ Type is required.");
    typeSelect.classList.add("flash-error");
    valid = false;
  }

  if (typeSelect.value && !categorySelect.value && !actionSelect.value) {
    showError("⛔ Add a Category and Action first before adding to report.");
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
    showError("⛔ Entry already added.");
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

// ---------- Save Daily Report ----------
function saveDailyReport() {
  if (!logEntries.length) {
    alert("No report content to save!");
    return;
  }
}

// ---------- Utilities ----------
function showError(message) {
  const container = document.getElementById("notification-container");
  const notif = document.createElement("div");
  notif.className = "notification error";
  notif.innerHTML = `
    <div class="content">
      <div class="title">Error!</div>
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

// ---------- Event Listeners ----------
typeSelect.addEventListener("change", refreshCategoryDropdown);
categorySelect.addEventListener("change", renderDynamicFields);
actionSelect.addEventListener("change", renderDynamicFields);
