document.addEventListener("DOMContentLoaded", async () => {
  const messageEl = document.querySelector("#message");
  const tableBody = document.querySelector("#patientRows");
  const sidebarInfo = document.querySelector("#sidebarSystemInfo");
  const userModeBadge = document.querySelector("#userModeBadge");

  // Form & Dialog references
  const patientDialog = document.querySelector("#patientDialog");
  const patientForm = document.querySelector("#patientForm");
  const dialogTitle = document.querySelector("#dialogTitle");
  const modalMessage = document.querySelector("#modalMessage");
  const savePatientBtn = document.querySelector("#savePatientBtn");

  // Details Dialog references
  const detailsDialog = document.querySelector("#detailsDialog");
  const detailsContent = document.querySelector("#detailsContent");
  const detailsModalMessage = document.querySelector("#detailsModalMessage");
  const dropboxBadge = document.querySelector("#dropboxStatusBadge");
  const documentForm = document.querySelector("#documentForm");
  const documentFileInput = document.querySelector("#documentFileInput");
  const uploadDocBtn = document.querySelector("#uploadDocumentBtn");
  const documentListEl = document.querySelector("#documentList");

  // Filter elements
  const searchInput = document.querySelector("#search");
  const genderFilter = document.querySelector("#genderFilter");
  const bloodFilter = document.querySelector("#bloodFilter");
  const statusFilter = document.querySelector("#statusFilter");
  const resetFiltersBtn = document.querySelector("#resetFiltersButton");

  let editingId = null;
  let currentPatientMongoId = null;
  let currentPatientData = null;
  let isDropboxReady = false;

  function showMessage(text, isError = false) {
    if (!text) {
      messageEl.hidden = true;
      messageEl.textContent = "";
      return;
    }
    messageEl.textContent = text;
    messageEl.className = isError ? "message error" : "message success";
    messageEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showModalMessage(el, text, isError = true) {
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = text;
    el.className = isError ? "message error" : "message success";
    el.hidden = false;
  }

  // Authenticate and load initial data
  try {
    const user = await PortalAuth.requireLogin();
    if (!user) return;

    document.querySelector("#userName").textContent = user.name || user.email || "Medical Staff";
    document.querySelector("#userEmail").textContent = user.email || "";

    if (user.isDemo) {
      userModeBadge.hidden = false;
      userModeBadge.textContent = "Local Demo Mode";
    }

    if (user.authError) {
      showMessage(`Notice: ${user.authError}`, true);
    }

    // Check system status
    try {
      const health = await PortalAuth.fetchServerHealth();
      if (sidebarInfo) {
        sidebarInfo.textContent = `DB: ${health.database} · Dropbox: ${health.dropbox}`;
      }
      isDropboxReady = health.dropbox === "configured";

      const dropboxTopPill = document.querySelector("#dropboxTopPill");
      if (dropboxTopPill) {
        if (isDropboxReady) {
          dropboxTopPill.textContent = "📁 Dropbox Connected";
          dropboxTopPill.className = "status-pill ready";
        } else {
          dropboxTopPill.textContent = "Dropbox Not Configured";
          dropboxTopPill.className = "status-pill missing";
        }
      }
    } catch {
      // ignore
    }

    document.querySelector("#logoutButton").addEventListener("click", () => {
      PortalAuth.logout();
    });

    await Promise.all([loadPatients(), loadStats()]);
  } catch (error) {
    showMessage(error.message, true);
    document.querySelector("#userName").textContent = "Access Restricted";
    tableBody.innerHTML = `<tr><td colspan="11" class="empty-cell error">
      <p style="margin-bottom:12px;">${escapeHTML(error.message)}</p>
      <button class="primary-button" id="reloginBtn" type="button">Log in with Auth0</button>
    </td></tr>`;
    const relogin = document.querySelector("#reloginBtn");
    if (relogin) relogin.addEventListener("click", () => PortalAuth.login());
  }

  // Load Dashboard Statistics
  async function loadStats() {
    try {
      const data = await apiRequest("/api/dashboard/stats");
      document.querySelector("#totalCount").textContent = data.total ?? "0";
      document.querySelector("#maleCount").textContent = data.male ?? "0";
      document.querySelector("#femaleCount").textContent = data.female ?? "0";
      document.querySelector("#todayCount").textContent = data.admittedToday ?? "0";
    } catch (err) {
      console.warn("Could not load dashboard statistics:", err.message);
    }
  }

  // Load Patients list with search and filters
  async function loadPatients() {
    const params = new URLSearchParams();
    const searchVal = searchInput.value.trim();
    const genderVal = genderFilter.value;
    const bloodVal = bloodFilter.value;
    const statusVal = statusFilter.value;

    if (searchVal) params.set("search", searchVal);
    if (genderVal) params.set("gender", genderVal);
    if (bloodVal) params.set("bloodGroup", bloodVal);
    if (statusVal) params.set("status", statusVal);

    tableBody.innerHTML = '<tr><td colspan="11" class="empty-cell">Loading records…</td></tr>';

    try {
      const data = await apiRequest(`/api/patients?${params.toString()}`);
      renderPatients(data.patients || []);
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="11" class="empty-cell error">${escapeHTML(err.message)}</td></tr>`;
      showMessage(err.message, true);
    }
  }

  function renderPatients(patients) {
    if (!patients.length) {
      tableBody.innerHTML = '<tr><td colspan="12" class="empty-cell">No matching patient records found. Click "+ Add patient" to create one.</td></tr>';
      return;
    }

    tableBody.innerHTML = patients.map((p) => `
      <tr>
        <td><strong>${escapeHTML(p.patientId)}</strong></td>
        <td>${escapeHTML(p.fullName)}</td>
        <td>${escapeHTML(p.age)}</td>
        <td>${escapeHTML(p.gender)}</td>
        <td><span class="blood-badge">${escapeHTML(p.bloodGroup)}</span></td>
        <td>${escapeHTML(p.diagnosis)}</td>
        <td>${escapeHTML(p.assignedDoctor)}</td>
        <td>${escapeHTML(p.contactNumber)}</td>
        <td>${escapeHTML(formatDate(p.admissionDate))}</td>
        <td><span class="status">${escapeHTML(p.status)}</span></td>
        <td>
          <button class="small-button doc-pill-btn" data-view-docs="${p._id}" type="button" title="View documents in Dropbox">📁 Docs</button>
        </td>
        <td class="actions">
          <button class="small-button" data-view="${p._id}" type="button">View</button>
          <button class="small-button" data-edit="${p._id}" type="button">Edit</button>
          <button class="small-button danger-button" data-delete="${p._id}" type="button">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  // Filters & Search handlers
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  searchInput.addEventListener("input", debounce(() => loadPatients(), 250));
  searchInput.addEventListener("search", () => loadPatients());
  genderFilter.addEventListener("change", () => loadPatients());
  bloodFilter.addEventListener("change", () => loadPatients());
  statusFilter.addEventListener("change", () => loadPatients());

  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    genderFilter.value = "";
    bloodFilter.value = "";
    statusFilter.value = "";
    loadPatients();
  });

  // Add / Edit Patient Modal logic
  function openForm(patient = null) {
    editingId = patient ? patient._id : null;
    patientForm.reset();
    showModalMessage(modalMessage, "");

    const formDocSec = document.querySelector("#formDocSection");
    if (formDocSec) {
      formDocSec.hidden = Boolean(patient); // Only show document attachment when creating a new patient
    }

    dialogTitle.textContent = patient ? "Edit patient record" : "Add new patient";
    savePatientBtn.textContent = patient ? "Update patient" : "Save patient";
    savePatientBtn.disabled = false;

    const dateVal = patient && patient.admissionDate
      ? new Date(patient.admissionDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    document.querySelector("#admissionDate").value = dateVal;

    if (patient) {
      const fields = [
        "fullName", "age", "gender", "bloodGroup", "diagnosis",
        "assignedDoctor", "contactNumber", "allergies", "status",
        "emergencyContact", "notes"
      ];
      for (const key of fields) {
        if (patientForm.elements[key]) {
          patientForm.elements[key].value = patient[key] !== undefined ? patient[key] : "";
        }
      }
    }

    patientDialog.showModal();
  }

  document.querySelector("#addPatientButton").addEventListener("click", () => openForm());
  document.querySelector("#closeDialog").addEventListener("click", () => patientDialog.close());
  document.querySelector("#cancelForm").addEventListener("click", () => patientDialog.close());

  // Patient Form Submission
  patientForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showModalMessage(modalMessage, "");

    const formData = new FormData(patientForm);
    const age = Number(formData.get("age"));

    if (!Number.isFinite(age) || age < 0 || age > 125) {
      showModalMessage(modalMessage, "Please enter a valid age between 0 and 125.");
      return;
    }

    const docFile = document.querySelector("#initialDocFile");
    const hasDocAttached = docFile && docFile.files && docFile.files.length > 0;

    if (hasDocAttached && docFile.files[0].size > 10 * 1024 * 1024) {
      showModalMessage(modalMessage, "Attached file is too large. Maximum size is 10 MB.");
      return;
    }

    savePatientBtn.disabled = true;
    savePatientBtn.textContent = hasDocAttached
      ? "Saving to database & Dropbox…"
      : "Saving to database…";

    try {
      const url = editingId ? `/api/patients/${editingId}` : "/api/patients";
      const method = editingId ? "PUT" : "POST";

      const res = await apiRequest(url, {
        method,
        body: formData
      });

      patientDialog.close();
      showMessage(res.message || (editingId ? "Patient updated successfully." : "Patient saved successfully."));
      await Promise.all([loadPatients(), loadStats()]);
    } catch (err) {
      showModalMessage(modalMessage, err.message, true);
    } finally {
      savePatientBtn.disabled = false;
      savePatientBtn.textContent = editingId ? "Update patient" : "Save patient";
    }
  });

  // Table row click dispatcher (View, Docs, Edit, Delete)
  tableBody.addEventListener("click", async (event) => {
    const target = event.target;
    const viewId = target.dataset.view;
    const viewDocsId = target.dataset.viewDocs;
    const editId = target.dataset.edit;
    const deleteId = target.dataset.delete;

    if (viewId || viewDocsId) {
      await openDetails(viewId || viewDocsId);
    } else if (editId) {
      try {
        const { patient } = await apiRequest(`/api/patients/${editId}`);
        openForm(patient);
      } catch (err) {
        showMessage(err.message, true);
      }
    } else if (deleteId) {
      if (confirm("Are you sure you want to delete this patient record?\n\nAll associated Dropbox documents and clinical metadata will also be permanently deleted.")) {
        try {
          const res = await apiRequest(`/api/patients/${deleteId}`, { method: "DELETE" });
          showMessage(res.message || "Patient deleted successfully.");
          await Promise.all([loadPatients(), loadStats()]);
        } catch (err) {
          showMessage(err.message, true);
        }
      }
    }
  });

  // Details Modal and Document Operations
  async function openDetails(patientId) {
    currentPatientMongoId = patientId;
    showModalMessage(detailsModalMessage, "");
    detailsContent.innerHTML = '<p class="empty-cell">Loading patient information…</p>';
    documentListEl.innerHTML = '<p class="empty-cell">Loading documents…</p>';
    documentForm.reset();

    detailsDialog.showModal();

    try {
      const { patient } = await apiRequest(`/api/patients/${patientId}`);
      currentPatientData = patient;

      document.querySelector("#detailsModalTitle").textContent = `${patient.fullName} (${patient.patientId})`;

      detailsContent.innerHTML = `
        <dl class="details-grid">
          <div><dt>Patient ID</dt><dd><strong>${escapeHTML(patient.patientId)}</strong></dd></div>
          <div><dt>Full Name</dt><dd>${escapeHTML(patient.fullName)}</dd></div>
          <div><dt>Age / Gender</dt><dd>${escapeHTML(patient.age)} years · ${escapeHTML(patient.gender)}</dd></div>
          <div><dt>Blood Group</dt><dd>${escapeHTML(patient.bloodGroup)}</dd></div>
          <div><dt>Status</dt><dd><span class="status">${escapeHTML(patient.status)}</span></dd></div>
          <div><dt>Assigned Doctor</dt><dd>${escapeHTML(patient.assignedDoctor)}</dd></div>
          <div><dt>Diagnosis</dt><dd>${escapeHTML(patient.diagnosis)}</dd></div>
          <div><dt>Contact Number</dt><dd>${escapeHTML(patient.contactNumber)}</dd></div>
          <div><dt>Admission Date</dt><dd>${escapeHTML(formatDate(patient.admissionDate))}</dd></div>
          <div><dt>Allergies</dt><dd>${escapeHTML(patient.allergies || "None recorded")}</dd></div>
          <div><dt>Emergency Contact</dt><dd>${escapeHTML(patient.emergencyContact || "Not provided")}</dd></div>
          <div><dt>Clinical Notes</dt><dd>${escapeHTML(patient.notes || "None")}</dd></div>
        </dl>
      `;

      await loadDocuments(patientId);
    } catch (err) {
      showModalMessage(detailsModalMessage, err.message, true);
    }
  }

  async function loadDocuments(patientMongoId) {
    documentListEl.innerHTML = '<p class="empty-cell">Loading documents…</p>';

    try {
      const data = await apiRequest(`/api/documents/patient/${patientMongoId}`);
      isDropboxReady = Boolean(data.dropboxConfigured);

      if (dropboxBadge) {
        if (isDropboxReady) {
          dropboxBadge.textContent = "Dropbox Ready";
          dropboxBadge.className = "status-pill ready";
          uploadDocBtn.disabled = false;
        } else {
          dropboxBadge.textContent = "Dropbox Not Configured";
          dropboxBadge.className = "status-pill missing";
          uploadDocBtn.disabled = true;
        }
      }

      renderDocuments(data.documents || []);
    } catch (err) {
      documentListEl.innerHTML = `<p class="empty-cell error">${escapeHTML(err.message)}</p>`;
    }
  }

  function renderDocuments(documents) {
    if (!documents.length) {
      documentListEl.innerHTML = '<p class="empty-cell">No documents uploaded for this patient yet.</p>';
      return;
    }

    documentListEl.innerHTML = `
      <ul class="document-list">
        ${documents.map((d) => `
          <li>
            <div>
              <strong>${escapeHTML(d.originalName)}</strong>
              <span>${escapeHTML(d.category)} · Uploaded ${escapeHTML(formatDate(d.createdAt))}</span>
            </div>
            <button class="small-button" data-download="${d._id}" type="button">Download</button>
            <button class="small-button danger-button" data-doc-delete="${d._id}" type="button">Delete</button>
          </li>
        `).join("")}
      </ul>
    `;
  }

  // Document Upload submission
  documentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showModalMessage(detailsModalMessage, "");

    if (!isDropboxReady) {
      showModalMessage(detailsModalMessage, "Dropbox is not configured. Cloud document uploads are unavailable.");
      return;
    }

    if (!documentFileInput.files.length) {
      showModalMessage(detailsModalMessage, "Please choose a file to upload.");
      return;
    }

    const file = documentFileInput.files[0];
    if (file.size > 10 * 1024 * 1024) {
      showModalMessage(detailsModalMessage, "File is too large. Maximum size is 10 MB.");
      return;
    }

    uploadDocBtn.disabled = true;
    uploadDocBtn.textContent = "Uploading to Dropbox…";

    const formData = new FormData(documentForm);

    try {
      const res = await apiRequest(`/api/documents/patient/${currentPatientMongoId}`, {
        method: "POST",
        body: formData
      });

      documentForm.reset();
      showModalMessage(detailsModalMessage, res.message || "Document uploaded successfully.", false);
      await loadDocuments(currentPatientMongoId);
    } catch (err) {
      showModalMessage(detailsModalMessage, err.message, true);
    } finally {
      uploadDocBtn.disabled = false;
      uploadDocBtn.textContent = "Upload to Dropbox";
    }
  });

  // Document List click handler (Download / Delete)
  documentListEl.addEventListener("click", async (event) => {
    const downloadId = event.target.dataset.download;
    const docDeleteId = event.target.dataset.docDelete;

    if (downloadId) {
      event.target.disabled = true;
      event.target.textContent = "Preparing…";
      try {
        const res = await apiRequest(`/api/documents/${downloadId}/download`);
        if (res.url) {
          // Safe download via temporary anchor to bypass browser popup blockers
          const a = document.createElement("a");
          a.href = res.url;
          a.download = res.filename || "document";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (err) {
        showModalMessage(detailsModalMessage, err.message, true);
      } finally {
        event.target.disabled = false;
        event.target.textContent = "Download";
      }
    } else if (docDeleteId) {
      if (confirm("Delete this document from Dropbox and patient records?")) {
        try {
          const res = await apiRequest(`/api/documents/${docDeleteId}`, { method: "DELETE" });
          showModalMessage(detailsModalMessage, res.message || "Document deleted.", false);
          await loadDocuments(currentPatientMongoId);
        } catch (err) {
          showModalMessage(detailsModalMessage, err.message, true);
        }
      }
    }
  });

  // Close details dialog buttons
  document.querySelector("#closeDetails").addEventListener("click", () => detailsDialog.close());
  document.querySelector("#closeDetailsBottom").addEventListener("click", () => detailsDialog.close());
});
