(function () {
  const dashboardCommon = window.DashboardCommon;

  if (!dashboardCommon) {
    throw new Error("DashboardCommon no esta disponible para reports.");
  }

  const {
    authHeaders,
    renderReportWithFilters: renderDashboardReportWithFilters,
    renderReportTable: renderDashboardReportTable,
    renderReportTableRows: renderDashboardReportTableRows,
    getReportFilterValues,
    applyReportFilters,
  } = dashboardCommon;

  let adminReportCache = [];
  let coachReportCache = [];
  let generalReportCache = [];

  function getApiUrl() {
    const rawBase = String(window.API_BASE || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
    if (window.location.protocol === "https:" && rawBase.startsWith("http://")) {
      return `https://${rawBase.slice(7)}`;
    }
    return rawBase;
  }

  function renderReportWithFilters(scope, rows) {
    return renderDashboardReportWithFilters(scope, rows, () => updateReportTable(scope));
  }

  function renderReportTable(rows, scope) {
    return renderDashboardReportTable(rows, scope);
  }

  function getReportFilteredData(scope) {
    const data = scope === "admin" ? adminReportCache : scope === "coach" ? coachReportCache : generalReportCache;
    const filters = getReportFilterValues(scope);
    return applyReportFilters(data, filters);
  }

  async function loadReport(scope, inputId, boxId, endpoint) {
    const monthInput = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    if (!monthInput || !box) return;

    const month = monthInput.value;
    if (!month) {
      box.innerHTML = `<div class="w3-center w3-text-red w3-small">Selecciona un mes.</div>`;
      return;
    }

    box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Generando reporte...</div>`;
    try {
      const res = await fetch(`${getApiUrl()}${endpoint}?month=${month}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte");

      if (scope === "admin") adminReportCache = data;
      else if (scope === "coach") coachReportCache = data;
      else generalReportCache = data;

      if (!data.length) {
        box.innerHTML = `<div class="w3-center w3-text-gray w3-small">Sin registros para el mes.</div>`;
        return;
      }

      box.innerHTML = renderReportWithFilters(scope, data);
    } catch (error) {
      box.innerHTML = `<div class="w3-center w3-text-red w3-small">${error.message}</div>`;
    }
  }

  async function loadMonthlyReport() {
    return loadReport("admin", "adminReportMonth", "adminMonthlyReport", "/training-sessions/report");
  }

  async function loadCoachMonthlyReport() {
    return loadReport("coach", "coachReportMonth", "coachMonthlyReport", "/training-sessions/report/my");
  }

  async function loadGeneralMonthlyReport() {
    return loadReport("general", "generalReportMonth", "generalMonthlyReport", "/training-sessions/report/general");
  }

  function exportReportCsv(scope) {
    const data = getReportFilteredData(scope);
    if (!data.length) return;
    const headers = [
      "Academia",
      "Categoria",
      "Nivel",
      "Entrenador",
      "Deportista",
      "Presente",
      "Ausente",
      "Justificado",
    ];
    const rows = data.map((row) => [
      row.academy_name || "",
      row.category_name || "",
      row.level_name || "",
      row.coach_name || "",
      row.athlete_name || "",
      row.present_count,
      row.absent_count,
      row.justified_count,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_asistencia_${scope}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportReportPdf(scope) {
    const data = getReportFilteredData(scope);
    if (!data.length) return;
    const html = `
      <html>
        <head>
          <title>Reporte de asistencia</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; }
            h2 { margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h2>Reporte de asistencia</h2>
          ${renderReportTable(data, "export")}
        </body>
      </html>
    `;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  function updateReportTable(scope) {
    const data = getReportFilteredData(scope);
    const body = document.getElementById(`${scope}ReportBody`);
    if (!body) return;
    body.innerHTML = renderDashboardReportTableRows(data);
  }

  window.DashboardReports = {
    loadMonthlyReport,
    loadCoachMonthlyReport,
    loadGeneralMonthlyReport,
    exportReportCsv,
    exportReportPdf,
    updateReportTable,
  };
})();