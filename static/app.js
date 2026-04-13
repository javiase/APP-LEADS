/* ─── State ─── */
const state = {
    metadata: null,
    dashboard: null,
    leads: [],
    filteredLeads: [],
    searchQuery: "",
    selectedLeadId: null,
    editingLeadId: null,
    myIgUsername: localStorage.getItem("my_ig_username") || "",
};

/* ─── Status pipeline order (for progress bar) ─── */
const STATUS_ORDER = [
    "pendiente mandarle mensaje",
    "Mensaje enviado",
    "Segundo mensaje enviado",
    "Tercer mensaje enviado",
    "hacer seguimiento",
    "Llamada agendada",
    "Llamada hecha",
    "Reunion hecha",
    "Implementado",
];

/* ─── Status bar colors for the distribution chart ─── */
const STATUS_BAR_COLORS = {
    "hacer seguimiento": "#e8734a",
    "pendiente mandarle mensaje": "#f09e7a",
    "Llamada hecha": "#d4cfc7",
    "Implementado": "#34d399",
    "Llamada agendada": "#60a5fa",
    "Tercer mensaje enviado": "#fbbf24",
    "Mensaje enviado": "#a78bfa",
    "Reunion hecha": "#f472b6",
    "Segundo mensaje enviado": "#fb923c",
};

/* ─── Elements ─── */
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
    igContactsList: document.getElementById("ig-contacts-list"),
    igMyAccountSection: document.getElementById("ig-my-account-section"),
    myIgInput: document.getElementById("my-ig-username"),
};

/* ─── Helpers ─── */

function formatDate(value) {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatResult(result) {
    return { active: "🔵 Activo", won: "✅ Ganado", lost: "❌ Perdido" }[result] || result;
}

function resultClass(result) {
    return { active: "result-active", won: "result-won", lost: "result-lost" }[result] || "";
}

function leadItemClass(lead) {
    if (lead.pipeline_result === "won") return "lead-won";
    if (lead.pipeline_result === "lost") return "lead-lost";
    return "";
}

function statusPill(status) {
    return `<span class="pill" data-status="${status}">${status}</span>`;
}

function resultPill(result) {
    const label = { active: "Activo", won: "Ganado", lost: "Perdido" }[result] || result;
    const icon = { active: "🔵", won: "✅", lost: "❌" }[result] || "";
    return `<span class="pill-result ${resultClass(result)}">${icon} ${label}</span>`;
}

function lastStatusTag(lead) {
    if (!lead.last_status_before_result) return "";
    if (lead.pipeline_result === "active") return "";
    return `<span class="last-status-tag">Cayó en: ${lead.last_status_before_result}</span>`;
}

function pipelineProgress(currentStatus) {
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    return `
        <div class="pipeline-progress">
            ${STATUS_ORDER.map((_, i) => {
                let cls = "";
                if (i < currentIdx) cls = "step-done";
                else if (i === currentIdx) cls = "step-current";
                return `<div class="pipeline-step ${cls}"></div>`;
            }).join("")}
        </div>
    `;
}

function igDmUrl(username) {
    if (!username) return null;
    const clean = username.replace(/^@/, "").trim();
    if (!clean) return null;
    return `https://ig.me/m/${clean}`;
}

function igProfileUrl(username) {
    if (!username) return null;
    const clean = username.replace(/^@/, "").trim();
    if (!clean) return null;
    return `https://www.instagram.com/${clean}/`;
}

/* ─── Dashboard Rendering ─── */

function renderSummary() {
    const s = state.dashboard.summary;
    const cards = [
        { label: "Leads totales", value: s.total_leads, cls: "" },
        { label: "Activos", value: s.active_leads, cls: "stat-accent" },
        { label: "Ganados", value: s.won_leads, cls: "stat-positive" },
        { label: "Perdidos", value: s.lost_leads, cls: "stat-negative" },
        { label: "Acciones hoy", value: s.due_today, cls: "stat-warning" },
        { label: "Vencidas", value: s.overdue, cls: s.overdue > 0 ? "stat-negative" : "" },
    ];

    elements.summaryCards.innerHTML = cards
        .map(
            (c) => `
                <article class="stat-card ${c.cls}">
                    <p class="eyebrow">${c.label}</p>
                    <strong>${c.value}</strong>
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
            <strong>${statusPill(item.status)}</strong>
            <span>${item.average_days} días</span>
            <span>${item.samples} muestras</span>
            <span class="${item.average_days > 3 ? "text-warning" : "text-positive"}">${item.average_days > 3 ? "⚠ Atención" : "✓ Normal"}</span>
        </div>
    `);

    renderMetricRows(elements.dropOffs, state.dashboard.drop_offs, (item) => `
        <div class="metric-row">
            <strong>${statusPill(item.status)}</strong>
            <span class="${item.lost > 0 ? "text-negative" : ""}">${item.lost} perdidos</span>
            <span class="${item.stalled > 0 ? "text-warning" : ""}">${item.stalled} estancados</span>
            <span class="${item.lost + item.stalled > 0 ? "text-negative" : "text-positive"}">${item.lost + item.stalled > 0 ? "⚠ Revisar" : "✓ Sano"}</span>
        </div>
    `);

    renderMetricRows(elements.templatePerformance, state.dashboard.template_performance, (item) => `
        <div class="metric-row">
            <strong>${item.template}</strong>
            <span>${item.total} leads</span>
            <span class="text-positive">${item.win_rate}% éxito</span>
            <span class="${item.loss_rate > 30 ? "text-negative" : ""}">${item.loss_rate}% pérdida</span>
        </div>
    `);

    const maxStatus = Math.max(...state.dashboard.status_distribution.map((item) => item.count), 1);
    elements.statusDistribution.innerHTML = state.dashboard.status_distribution
        .map(
            (item) => `
                <div class="status-bar-item">
                    <div class="lead-meta" style="margin-bottom:4px">
                        ${statusPill(item.status)}
                        <span style="margin-left:auto; font-weight:600;">${item.count}</span>
                    </div>
                    <div class="status-bar">
                        <span style="width: ${(item.count / maxStatus) * 100}%; background: ${STATUS_BAR_COLORS[item.status] || "#e8734a"}"></span>
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
                        ${event.new_status ? statusPill(event.new_status) : ""}
                        ${event.new_result ? resultPill(event.new_result) : ""}
                        ${!event.new_status && !event.new_result ? `<span>${event.template_variant || "Registro"}</span>` : ""}
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
        elements.focusContent.innerHTML = "<strong>Sin acciones programadas</strong><p style='margin:4px 0 0;font-size:0.82rem;color:var(--muted)'>Agrega una fecha de acción a un lead.</p>";
        return;
    }

    const isOverdue = new Date(nextLead.action_due_at) < new Date();
    elements.focusContent.innerHTML = `
        <strong style="font-size:0.92rem">${nextLead.name}</strong>
        <p style="margin:4px 0;font-size:0.85rem;color:var(--text-secondary)">${nextLead.action_label || "Sin acción definida"}</p>
        <p class="eyebrow" style="color:${isOverdue ? 'var(--red)' : 'var(--muted)'}">
            ${isOverdue ? "⚠ VENCIDA" : "Vence"} ${formatDate(nextLead.action_due_at)}
        </p>
    `;
}

/* ─── Lead List ─── */

function getVisibleLeads() {
    return state.searchQuery ? state.filteredLeads : state.leads;
}

function renderLeadList() {
    const visibleLeads = getVisibleLeads();
    if (!visibleLeads.length) {
        elements.leadList.innerHTML = `
            <div class="detail-card" style="text-align:center;padding:40px 20px">
                <p class="eyebrow">Sin resultados</p>
                <strong>No hay leads que coincidan.</strong>
            </div>
        `;
        return;
    }

    elements.leadList.innerHTML = visibleLeads
        .map(
            (lead) => `
                <article class="lead-item ${lead.id === state.selectedLeadId ? "is-active" : ""} ${leadItemClass(lead)}" data-lead-id="${lead.id}">
                    <div class="lead-title">${lead.name}</div>
                    <div class="lead-meta">
                        ${statusPill(lead.current_status)}
                        ${resultPill(lead.pipeline_result)}
                    </div>
                    ${lastStatusTag(lead) ? `<div class="lead-meta">${lastStatusTag(lead)}</div>` : ""}
                    <div class="lead-meta">
                        <span>${lead.handle || "Sin handle"}</span>
                        <span>·</span>
                        <span>${lead.mentor_store || "Sin tienda"}</span>
                    </div>
                    ${pipelineProgress(lead.current_status)}
                </article>
            `
        )
        .join("");
}

/* ─── Lead Detail ─── */

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

    const igUser = lead.instagram_username || lead.handle?.replace(/^@/, "") || "";
    const dmLink = igDmUrl(igUser);
    const profileLink = igProfileUrl(igUser);

    elements.leadDetail.innerHTML = `
        <article class="detail-card">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Ficha</p>
                    <h3 class="detail-title">${lead.name}</h3>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    ${dmLink ? `<a href="${dmLink}" target="_blank" class="ig-dm-button">📸 DM</a>` : ""}
                    <button class="primary-button" id="edit-selected-lead">Editar</button>
                </div>
            </div>
            <div class="detail-meta">
                ${statusPill(lead.current_status)}
                ${resultPill(lead.pipeline_result)}
                ${lastStatusTag(lead)}
            </div>
            ${pipelineProgress(lead.current_status)}
            <div class="detail-grid">
                <div class="detail-block">
                    <p class="eyebrow">Handle</p>
                    <strong>${lead.handle || "Sin handle"}</strong>
                    ${profileLink ? `<p><a href="${profileLink}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:0.82rem">Ver perfil IG →</a></p>` : ""}
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Mentor/Tienda</p>
                    <strong>${lead.mentor_store || "Sin tienda"}</strong>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Plantilla A/B</p>
                    <strong>${lead.ab_variant || "Sin definir"}</strong>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Siguiente acción</p>
                    <strong>${lead.action_label || "Sin acción definida"}</strong>
                    <p>${lead.action_due_at ? formatDate(lead.action_due_at) : "Sin fecha"}</p>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Creado</p>
                    <strong>${formatDate(lead.created_at)}</strong>
                </div>
                <div class="detail-block">
                    <p class="eyebrow">Última actualización</p>
                    <strong>${formatDate(lead.updated_at)}</strong>
                </div>
            </div>
            <section class="detail-stack">
                <div class="detail-block">
                    <p class="eyebrow">Comentarios</p>
                    <p>${lead.comments || "Sin comentarios"}</p>
                </div>
                <div>
                    <p class="eyebrow" style="margin-bottom:10px">Historial completo</p>
                    <div class="timeline">
                        ${lead.history
                            .map(
                                (event) => `
                                    <article class="timeline-item">
                                        <div class="event-title">${event.title}</div>
                                        <div class="timeline-meta">
                                            <span>${formatDate(event.created_at)}</span>
                                            ${event.new_status ? statusPill(event.new_status) : ""}
                                            ${event.new_result ? resultPill(event.new_result) : ""}
                                            ${!event.new_status && !event.new_result ? `<span>${event.template_variant || event.action_label || event.event_type}</span>` : ""}
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

/* ─── Instagram Section ─── */

function renderInstagram() {
    const myUser = state.myIgUsername;

    // My account section
    if (myUser) {
        elements.igMyAccountSection.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.03);border:1px solid var(--line)">
                <div class="ig-contact-avatar" style="width:42px;height:42px;font-size:1rem">${myUser.charAt(0).toUpperCase()}</div>
                <div style="flex:1">
                    <div class="ig-contact-name">@${myUser}</div>
                    <div class="ig-contact-handle">Tu cuenta conectada</div>
                </div>
                <a href="https://www.instagram.com/${myUser}/" target="_blank" class="ig-user-link">Abrir Instagram</a>
            </div>
        `;
    } else {
        elements.igMyAccountSection.innerHTML = `
            <div class="ig-empty-state" style="padding:30px">
                <div class="ig-big-icon">IG</div>
                <strong>Configura tu Instagram</strong>
                <p style="font-size:0.85rem;margin:6px 0 0">Escribe tu usuario en el panel lateral izquierdo para empezar.</p>
            </div>
        `;
    }

    // Contacts from leads
    const leadsWithIg = state.leads.filter((lead) => {
        const igUser = lead.instagram_username || lead.handle?.replace(/^@/, "") || "";
        return igUser.trim().length > 0;
    });

    if (!leadsWithIg.length) {
        elements.igContactsList.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--muted)">
                <p>No hay leads con usuario de Instagram.</p>
                <p style="font-size:0.82rem">Añade el usuario de Instagram al crear o editar un lead.</p>
            </div>
        `;
        return;
    }

    elements.igContactsList.innerHTML = leadsWithIg
        .map((lead) => {
            const igUser = lead.instagram_username || lead.handle?.replace(/^@/, "") || "";
            const dm = igDmUrl(igUser);
            return `
                <div class="ig-contact-item">
                    <div class="ig-contact-info">
                        <div class="ig-contact-avatar">${lead.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="ig-contact-name">${lead.name}</div>
                            <div class="ig-contact-handle">@${igUser}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        ${statusPill(lead.current_status)}
                        ${dm ? `<a href="${dm}" target="_blank" class="ig-dm-button">Abrir DM →</a>` : ""}
                    </div>
                </div>
            `;
        })
        .join("");
}

/* ─── API ─── */

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

/* ─── Data Loading ─── */

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
    renderInstagram();
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

/* ─── Modal ─── */

function openModal(lead = null) {
    state.editingLeadId = lead ? lead.id : null;
    elements.modalTitle.textContent = lead ? "Editar lead" : "Nuevo lead";
    elements.leadForm.reset();

    const formData = {
        id: lead?.id || "",
        name: lead?.name || "",
        handle: lead?.handle || "",
        mentor_store: lead?.mentor_store || "",
        instagram_username: lead?.instagram_username || "",
        current_status: lead?.current_status || state.metadata.statuses[0],
        pipeline_result: lead?.pipeline_result || "active",
        ab_variant: lead?.ab_variant || "",
        action_label: lead?.action_label || "",
        action_due_at: lead?.action_due_at ? lead.action_due_at.slice(0, 16) : "",
        comments: lead?.comments || "",
    };

    Object.entries(formData).forEach(([key, value]) => {
        const field = elements.leadForm.elements.namedItem(key);
        if (field) field.value = value;
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
              [lead.name, lead.handle, lead.mentor_store, lead.current_status, lead.ab_variant, lead.instagram_username]
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

/* ─── Navigation & Events ─── */

function wireNavigation() {
    document.querySelectorAll(".menu-link").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".menu-link").forEach((node) => node.classList.remove("is-active"));
            document.querySelectorAll(".section").forEach((node) => node.classList.remove("is-visible"));
            button.classList.add("is-active");
            document.getElementById(`section-${button.dataset.section}`).classList.add("is-visible");

            // Re-render instagram when switching to that tab
            if (button.dataset.section === "instagram") {
                renderInstagram();
            }
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
        if (item) selectLead(item.dataset.leadId);
    });

    // Instagram username save
    elements.myIgInput.value = state.myIgUsername;
    elements.myIgInput.addEventListener("input", () => {
        state.myIgUsername = elements.myIgInput.value.trim().replace(/^@/, "");
        localStorage.setItem("my_ig_username", state.myIgUsername);
    });
    elements.myIgInput.addEventListener("change", () => {
        renderInstagram();
    });
}

/* ─── Bootstrap ─── */

async function bootstrap() {
    try {
        await loadMetadata();
        await Promise.all([loadDashboard(), loadLeads()]);
        wireNavigation();
        wireEvents();
    } catch (error) {
        document.body.innerHTML = `<main class="empty-state" style="min-height:100vh"><h4>Error cargando la app</h4><p>${error.message}</p></main>`;
    }
}

bootstrap();
