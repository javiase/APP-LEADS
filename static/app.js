const state = {
    metadata: null,
    dashboard: null,
    leads: [],
    filteredLeads: [],
    searchQuery: "",
    selectedLeadId: null,
    editingLeadId: null,
};

const elements = {
    summaryCards: document.getElementById("summary-cards"),
    timeInStatus: document.getElementById("time-in-status"),
    dropOffs: document.getElementById("drop-offs"),
    templatePerformance: document.getElementById("template-performance"),
    statusDistribution: document.getElementById("status-distribution"),
    leadList: document.getElementById("lead-list"),
    leadDetail: document.getElementById("lead-detail"),
    activityList: document.getElementById("activity-list"),
    focusContent: document.getElementById("focus-content"),
    leadSearch: document.getElementById("lead-search"),
    modal: document.getElementById("lead-modal"),
    leadForm: document.getElementById("lead-form"),
    modalTitle: document.getElementById("modal-title"),
    statusSelect: document.getElementById("status-select"),
};

function formatDate(value) {
    if (!value) {
        return "Sin fecha";
    }
    return new Date(value).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatResult(result) {
    return { active: "Activo", won: "Ganado", lost: "Perdido" }[result] || result;
}

function renderSummary() {
    const summary = state.dashboard.summary;
    const cards = [
        ["Leads totales", summary.total_leads],
        ["Activos", summary.active_leads],
        ["Ganados", summary.won_leads],
        ["Perdidos", summary.lost_leads],
        ["Acciones hoy", summary.due_today],
        ["Acciones vencidas", summary.overdue],
    ];

    elements.summaryCards.innerHTML = cards
        .map(
            ([label, value]) => `
                <article class="stat-card">
                    <p class="eyebrow">${label}</p>
                    <strong>${value}</strong>
                </article>
            `
        )
        .join("");
}

function renderMetricRows(container, rows, renderer) {
    container.innerHTML = rows.map(renderer).join("");
}

function renderDashboard() {
    renderSummary();

    renderMetricRows(elements.timeInStatus, state.dashboard.time_in_status, (item) => `
        <div class="metric-row">
            <strong>${item.status}</strong>
            <span>${item.average_days} dias</span>
            <span>${item.samples} muestras</span>
            <span>${item.average_days > 3 ? "Atencion" : "Normal"}</span>
        </div>
    `);

    renderMetricRows(elements.dropOffs, state.dashboard.drop_offs, (item) => `
        <div class="metric-row">
            <strong>${item.status}</strong>
            <span class="${item.lost > 0 ? "text-negative" : ""}">${item.lost} perdidos</span>
            <span class="${item.stalled > 0 ? "text-negative" : ""}">${item.stalled} estancados</span>
            <span>${item.lost + item.stalled > 0 ? "Revisar" : "Sano"}</span>
        </div>
    `);

    renderMetricRows(elements.templatePerformance, state.dashboard.template_performance, (item) => `
        <div class="metric-row">
            <strong>${item.template}</strong>
            <span>${item.total} leads</span>
            <span class="text-positive">${item.win_rate}% exito</span>
            <span class="${item.loss_rate > 30 ? "text-negative" : ""}">${item.loss_rate}% perdida</span>
        </div>
    `);

    const maxStatus = Math.max(...state.dashboard.status_distribution.map((item) => item.count), 1);
    elements.statusDistribution.innerHTML = state.dashboard.status_distribution
        .map(
            (item) => `
                <div class="status-bar-item">
                    <div class="lead-meta">
                        <strong>${item.status}</strong>
                        <span>${item.count}</span>
                    </div>
                    <div class="status-bar">
                        <span style="width: ${(item.count / maxStatus) * 100}%"></span>
                    </div>
                </div>
            `
        )
        .join("");

    elements.activityList.innerHTML = state.dashboard.recent_activity
        .map(
            (event) => `
                <article class="timeline-item">
                    <div class="event-title">${event.title}</div>
                    <div class="timeline-meta">
                        <span>${formatDate(event.created_at)}</span>
                        <span>${event.new_status || event.new_result || event.template_variant || "Registro"}</span>
                    </div>
                    ${event.note ? `<p>${event.note}</p>` : ""}
                </article>
            `
        )
        .join("");

    renderSidebarFocus();
}

function renderSidebarFocus() {
    const nextLead = [...state.leads]
        .filter((lead) => lead.pipeline_result === "active" && lead.action_due_at)
        .sort((a, b) => new Date(a.action_due_at) - new Date(b.action_due_at))[0];

    if (!nextLead) {
        elements.focusContent.innerHTML = "<strong>No hay acciones programadas</strong><p>Cuando agregues una fecha de accion, aparecera aqui.</p>";
        return;
    }

    elements.focusContent.innerHTML = `
        <strong>${nextLead.name}</strong>
        <p>${nextLead.action_label || "Sin accion definida"}</p>
        <p class="eyebrow">Vence ${formatDate(nextLead.action_due_at)}</p>
    `;
}

function getVisibleLeads() {
    return state.searchQuery ? state.filteredLeads : state.leads;
}

function renderLeadList() {
    const visibleLeads = getVisibleLeads();
    if (!visibleLeads.length) {
        elements.leadList.innerHTML = `
            <div class="detail-card">
                <p class="eyebrow">Sin resultados</p>
                <strong>No hay leads que coincidan con la busqueda actual.</strong>
            </div>
        `;
        return;
    }

    elements.leadList.innerHTML = visibleLeads
        .map(
            (lead) => `
                <article class="lead-item ${lead.id === state.selectedLeadId ? "is-active" : ""}" data-lead-id="${lead.id}">
                    <div class="lead-title">${lead.name}</div>
                    <div class="lead-meta">
                        <span class="pill">${lead.current_status}</span>
                        <span>${formatResult(lead.pipeline_result)}</span>
                    </div>
                    <div class="lead-meta">
                        <span>${lead.handle || "Sin handle"}</span>
                        <span>${lead.mentor_store || "Sin tienda"}</span>
                    </div>
                    <div class="lead-meta">
                        <span>${lead.ab_variant || "Sin plantilla"}</span>
                        <span>Actualizado ${formatDate(lead.updated_at)}</span>
                    </div>
                </article>
            `
        )
        .join("");
}

function renderLeadDetail(lead) {
    if (!lead) {
        elements.leadDetail.innerHTML = `
            <div class="empty-state">
                <h4>Selecciona un lead</h4>
                <p>Aqui veras su ficha completa, proxima accion e historial de estados.</p>
            </div>
        `;
        return;
    }

    elements.leadDetail.innerHTML = `
        <article class="detail-card">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Ficha</p>
                    <h3 class="detail-title">${lead.name}</h3>
                </div>
                <button class="primary-button" id="edit-selected-lead">Editar</button>
            </div>
            <div class="detail-meta">
                <span class="pill">${lead.current_status}</span>
                <span>${formatResult(lead.pipeline_result)}</span>
                <span>${lead.handle || "Sin handle"}</span>
                <span>${lead.mentor_store || "Sin tienda"}</span>
            </div>
            <div class="detail-grid">
                <div class="detail-block">
                    <p class="eyebrow">Plantilla A/B</p>
                    <strong>${lead.ab_variant || "Sin definir"}</strong>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Siguiente accion</p>
                    <strong>${lead.action_label || "Sin accion definida"}</strong>
                    <p>${lead.action_due_at ? formatDate(lead.action_due_at) : "Sin fecha"}</p>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Creado</p>
                    <strong>${formatDate(lead.created_at)}</strong>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Ultima actualizacion</p>
                    <strong>${formatDate(lead.updated_at)}</strong>
                </div>
            </div>
            <section class="detail-stack">
                <div class="detail-block">
                    <p class="eyebrow">Comentarios</p>
                    <p>${lead.comments || "Sin comentarios"}</p>
                </div>
                <div>
                    <p class="eyebrow">Historial completo</p>
                    <div class="timeline">
                        ${lead.history
                            .map(
                                (event) => `
                                    <article class="timeline-item">
                                        <div class="event-title">${event.title}</div>
                                        <div class="timeline-meta">
                                            <span>${formatDate(event.created_at)}</span>
                                            <span>${event.new_status || event.new_result || event.template_variant || event.action_label || event.event_type}</span>
                                        </div>
                                        ${event.note ? `<p>${event.note}</p>` : ""}
                                    </article>
                                `
                            )
                            .join("")}
                    </div>
                </div>
            </section>
        </article>
    `;

    document.getElementById("edit-selected-lead").addEventListener("click", () => openModal(lead));
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Error inesperado");
    }
    return data;
}

async function loadMetadata() {
    state.metadata = await api("/api/metadata");
    elements.statusSelect.innerHTML = state.metadata.statuses
        .map((status) => `<option value="${status}">${status}</option>`)
        .join("");
}

async function loadDashboard() {
    state.dashboard = await api("/api/dashboard");
    renderDashboard();
}

async function loadLeads() {
    const data = await api("/api/leads");
    state.leads = data.items;
    if (state.searchQuery) {
        applyLeadFilter();
    } else {
        renderLeadList();
    }
    renderSidebarFocus();
    if (!state.selectedLeadId && state.leads.length) {
        await selectLead(state.leads[0].id);
    }
}

async function selectLead(leadId) {
    state.selectedLeadId = Number(leadId);
    renderLeadList();
    const lead = await api(`/api/leads/${leadId}`);
    renderLeadDetail(lead);
}

function openModal(lead = null) {
    state.editingLeadId = lead ? lead.id : null;
    elements.modalTitle.textContent = lead ? "Editar lead" : "Nuevo lead";
    elements.leadForm.reset();

    const formData = {
        id: lead?.id || "",
        name: lead?.name || "",
        handle: lead?.handle || "",
        mentor_store: lead?.mentor_store || "",
        current_status: lead?.current_status || state.metadata.statuses[0],
        pipeline_result: lead?.pipeline_result || "active",
        ab_variant: lead?.ab_variant || "",
        action_label: lead?.action_label || "",
        action_due_at: lead?.action_due_at ? lead.action_due_at.slice(0, 16) : "",
        comments: lead?.comments || "",
    };

    Object.entries(formData).forEach(([key, value]) => {
        const field = elements.leadForm.elements.namedItem(key);
        if (field) {
            field.value = value;
        }
    });

    elements.modal.showModal();
}

function closeModal() {
    elements.modal.close();
    state.editingLeadId = null;
}

function applyLeadFilter() {
    state.searchQuery = elements.leadSearch.value.trim().toLowerCase();
    state.filteredLeads = state.searchQuery
        ? state.leads.filter((lead) =>
              [lead.name, lead.handle, lead.mentor_store, lead.current_status, lead.ab_variant]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(state.searchQuery))
          )
        : [];
    renderLeadList();
}

async function submitLeadForm(event) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(elements.leadForm).entries());
    const payload = {
        ...raw,
        action_due_at: raw.action_due_at ? `${raw.action_due_at}:00` : null,
    };

    try {
        if (state.editingLeadId) {
            await api(`/api/leads/${state.editingLeadId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        } else {
            await api("/api/leads", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }

        closeModal();
        await Promise.all([loadDashboard(), loadLeads()]);
        if (state.selectedLeadId) {
            await selectLead(state.selectedLeadId);
        }
    } catch (error) {
        window.alert(error.message);
    }
}

function wireNavigation() {
    document.querySelectorAll(".menu-link").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".menu-link").forEach((node) => node.classList.remove("is-active"));
            document.querySelectorAll(".section").forEach((node) => node.classList.remove("is-visible"));
            button.classList.add("is-active");
            document.getElementById(`section-${button.dataset.section}`).classList.add("is-visible");
        });
    });
}

function wireEvents() {
    document.getElementById("open-create-modal").addEventListener("click", () => openModal());
    document.getElementById("close-modal").addEventListener("click", closeModal);
    document.getElementById("reset-form").addEventListener("click", () => elements.leadForm.reset());
    elements.leadForm.addEventListener("submit", submitLeadForm);
    elements.leadSearch.addEventListener("input", applyLeadFilter);
    elements.leadList.addEventListener("click", (event) => {
        const item = event.target.closest("[data-lead-id]");
        if (item) {
            selectLead(item.dataset.leadId);
        }
    });
}

async function bootstrap() {
    try {
        await loadMetadata();
        await Promise.all([loadDashboard(), loadLeads()]);
        wireNavigation();
        wireEvents();
    } catch (error) {
        document.body.innerHTML = `<main class="empty-state"><h4>Error cargando la app</h4><p>${error.message}</p></main>`;
    }
}

bootstrap();
