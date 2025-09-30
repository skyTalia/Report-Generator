const actionSelect = document.getElementById("action");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const dynamicArea = document.getElementById("dynamicArea");
const previewBox = document.getElementById("previewBox");
const addToReportBtn = document.getElementById("addToReport");
const detailedReport = document.getElementById("detailedReport");
const summaryReport = document.getElementById("summaryReport");

let reportEntries = { company: [], study: [] };
let summaryCounts = { company: { edited: 0, deleted: 0, added: 0, merged: 0 }, study: { edited: 0, deleted: 0, added: 0, merged: 0 } };
let mergeCompanies = [];
let logEntries = [];
let savedReports = JSON.parse(localStorage.getItem("savedReports") || "[]");

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
  categorySelect.innerHTML = "<option value=\"\">Select Category</option>";
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
  } else if (action === "deleted") {
    categorySelect.disabled = true;
    html = `
      <input type="text" id="name" placeholder="Name"> was deleted (Reason<span class="required">*</span>: 
      <input type="text" id="reason" placeholder="Reason">)
      <div id="reasonError" class="error-msg"></div>
    `;
  } else if (action === "added") {
    categorySelect.disabled = true;
    html = `
      <input type="text" id="name" placeholder="Name"> was added
    `;
  } else if (action === "merged" && typeSelect.value === "company") {
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

  dynamicArea.innerHTML = html;
  attachPreviewListeners();
}

function addMergeCompany() {
  const mergeInput = document.getElementById("mergeInput");
  const mergeList = document.getElementById("mergeList");

  if (mergeInput.value.trim() !== "") {
    mergeCompanies.push(mergeInput.value.trim());
    const li = document.createElement("li");
    li.textContent = mergeInput.value.trim();
    mergeList.appendChild(li);
    mergeInput.value = "";
  }
  updatePreview();
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
    text = `${name} [${subCategory}] was edited from \"${fromValue}\" to \"${toValue}\"`;
  } else if (action === "deleted") {
    const reason = document.getElementById("reason")?.value || "[Reason]";
    text = `${name} was deleted (Reason: ${reason})`;
  } else if (action === "added") {
    text = `${name} was added`;
  } else if (action === "merged" && typeSelect.value === "company") {
    const targetCompany = document.getElementById("targetCompany")?.value || "[Target Company]";
    text = `Companies: ${mergeCompanies.join(", ")} were merged to ${targetCompany}`;
  }

  previewBox.textContent = text;
  return text;
}

// ---------- Add to Report ----------
addToReportBtn.addEventListener("click", () => {
  let valid = true;

  // Reset errors
  document.getElementById("typeError").textContent = "";
  typeSelect.classList.remove("flash-error");
  const reasonInput = document.getElementById("reason");
  if (reasonInput) {
    const reasonError = document.getElementById("reasonError");
    if (reasonError) reasonError.textContent = "";
    reasonInput.classList.remove("flash-error");
  }

  // Validate Type
  if (!typeSelect.value) {
    const typeError = document.getElementById("typeError");
    if (typeError) typeError.textContent = "Type is required.";
    typeSelect.classList.add("flash-error");
    valid = false;
  }

  // Validate Category + Action when only Type is filled
  if (typeSelect.value && !categorySelect.value && !actionSelect.value) {
    let catActMsg = document.getElementById("catActMsg");
    if (!catActMsg) {
      catActMsg = document.createElement("div");
      catActMsg.id = "catActMsg";
      catActMsg.classList.add("error-msg");
      previewBox.insertAdjacentElement("afterend", catActMsg);
    }
    catActMsg.textContent = "⚠️ Add a Category and Action first before adding to report.";
    valid = false;
  } else {
    const catActMsg = document.getElementById("catActMsg");
    if (catActMsg) catActMsg.remove(); // clear old warning
  } 

  // Validate Reason if Deleted
  if (actionSelect.value === "deleted") {
    const reason = document.getElementById("reason")?.value.trim();
    if (!reason) {
      let reasonError = document.getElementById("reasonError");
      if (!reasonError) {
        const errorDiv = document.createElement("div");
        errorDiv.id = "reasonError";
        errorDiv.classList.add("error-msg");
        document.getElementById("reason").insertAdjacentElement("afterend", errorDiv);
        reasonError = errorDiv;
      }
      reasonError.textContent = "Reason is required.";
      reasonInput.classList.add("flash-error");
      valid = false;
    }
  }

  if (!valid) return; // stop if validation failed

  // 🔹 proceed if valid
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
  } else if (action === "deleted") {
    const reason = reasonInput.value || "unspecified";
    details = `Reason: ${reason}`;
  } else if (action === "merged" && type === "company") {
    const targetCompany = document.getElementById("targetCompany")?.value || "[Target]";
    details = `Merged into ${targetCompany}`;
  }

  logEntries.push({ date: today, type, name, category, subCategory, action, details });

  const entry = updatePreview();
  // Check for duplicates
  if (reportEntries[type].includes(entry)) {
    let dupMsg = document.getElementById("duplicateMsg");
    if (!dupMsg) {
      dupMsg = document.createElement("div");
      dupMsg.id = "duplicateMsg";
      dupMsg.classList.add("error-msg");
      previewBox.insertAdjacentElement("afterend", dupMsg);
    }
    dupMsg.textContent = "⚠️ Entry already added.";
    return; // stop here
  } else {
    const dupMsg = document.getElementById("duplicateMsg");
    if (dupMsg) dupMsg.remove(); // clear old warning
  }

  // Add if not duplicate
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
    detailedText += "Studies:\n" + reportEntries.study.join("\n") + "\n";
  }
  detailedReport.value = detailedText.trim();

  let summaryText = "Daily Summary:\n";
  if (summaryCounts.company.edited || summaryCounts.company.added || summaryCounts.company.deleted || summaryCounts.company.merged) {
    summaryText += "Companies:\n";
    if (summaryCounts.company.edited) summaryText += `- ${summaryCounts.company.edited} edited\n`;
    if (summaryCounts.company.deleted) summaryText += `- ${summaryCounts.company.deleted} deleted\n`;
    if (summaryCounts.company.added) summaryText += `- ${summaryCounts.company.added} added\n`;
    if (summaryCounts.company.merged) summaryText += `- ${summaryCounts.company.merged} merged\n`;
  }
  if (summaryCounts.study.edited || summaryCounts.study.added || summaryCounts.study.deleted || summaryCounts.study.merged) {
    summaryText += "Studies:\n";
    if (summaryCounts.study.edited) summaryText += `- ${summaryCounts.study.edited} edited\n`;
    if (summaryCounts.study.deleted) summaryText += `- ${summaryCounts.study.deleted} deleted\n`;
    if (summaryCounts.study.added) summaryText += `- ${summaryCounts.study.added} added\n`;
    if (summaryCounts.study.merged) summaryText += `- ${summaryCounts.study.merged} merged\n`;
  }
  summaryReport.value = summaryText.trim();
}

// ---------- Save Daily Report ----------
function saveDailyReport() {
  if (!logEntries.length) {
    alert("No report content to save!");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  let content = "---------------------------------------------------------------------------------------------\n";
  content += "Date        | Type     | Name           | Category      | Sub-Category   | Action   | Details\n";
  content += "---------------------------------------------------------------------------------------------\n";

  logEntries.forEach(e => {
    content += `${e.date}  | ${e.type.padEnd(8)} | ${e.name.padEnd(14)} | ${e.category.padEnd(12)} | ${e.subCategory.padEnd(14)} | ${e.action.padEnd(7)} | ${e.details}\n`;
  });

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const filename = `report-${today}.txt`;

  savedReports.unshift({ url, filename, label: `${today} Report` });
  localStorage.setItem("savedReports", JSON.stringify(savedReports));

  renderSavedReports();

  // Reset
  logEntries = [];
  reportEntries = { company: [], study: [] };
  summaryCounts = { company: { edited: 0, deleted: 0, added: 0, merged: 0 }, study: { edited: 0, deleted: 0, added: 0, merged: 0 } };

  detailedReport.value = "";
  summaryReport.value = "";
  previewBox.textContent = "[Preview will appear here]";
  dynamicArea.innerHTML = "";
}

// ---------- Render Saved Reports ----------
function renderSavedReports() {
  const savedReportsContainer = document.getElementById("savedReports");
  savedReportsContainer.innerHTML = "<h4>Saved Reports</h4>";
  savedReports.forEach((report, index) => {
    const container = document.createElement("div");
    container.classList.add("saved-report-container");

    const link = document.createElement("a");
    link.href = report.url;
    link.download = report.filename;
    link.textContent = report.label;
    link.classList.add("saved-report");

    const delBtn = document.createElement("button");
    delBtn.textContent = "❌";
    delBtn.classList.add("delete-btn");
    delBtn.onclick = () => deleteReport(index);

    container.appendChild(link);
    container.appendChild(delBtn);
    savedReportsContainer.appendChild(container);
  });
}

function deleteReport(index) {
  savedReports.splice(index, 1);
  localStorage.setItem("savedReports", JSON.stringify(savedReports));
  renderSavedReports();
}

// ---------- Utilities ----------
function copyToClipboard(id) {
  const el = document.getElementById(id);

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    el.select();
    el.setSelectionRange(0, 99999); // for mobile
    document.execCommand("copy");
  } else {
    // fallback for non-inputs
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
  }
}

function clearTextarea(id) {
  const el = document.getElementById(id);
  if (el) {
    el.value = "";
  }
}

// ---------- Event Listeners ----------
typeSelect.addEventListener("change", refreshCategoryDropdown);
categorySelect.addEventListener("change", renderDynamicFields);
actionSelect.addEventListener("change", renderDynamicFields);

// Reset Entry button
document.getElementById("resetEntry").addEventListener("click", () => {
  typeSelect.value = "";
  categorySelect.innerHTML = "<option value=''>Select Category</option>";
  actionSelect.value = "";
  dynamicArea.innerHTML = "";
  previewBox.textContent = "[Preview will appear here]";
  
  // Clear validation messages
  document.getElementById("typeError").textContent = "";
  const reasonError = document.getElementById("reasonError");
  if (reasonError) reasonError.textContent = "";
  const catActMsg = document.getElementById("catActMsg");
  if (catActMsg) catActMsg.textContent = "";
});
