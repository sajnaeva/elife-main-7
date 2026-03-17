import * as XLSX from "xlsx";
import { PennyekartAgent, ROLE_LABELS } from "@/hooks/usePennyekartAgents";

interface PanchayathInfo {
  id: string;
  name: string;
}

function buildRows(agents: PennyekartAgent[], panchayaths: PanchayathInfo[]) {
  const panchayathMap = new Map(panchayaths.map(p => [p.id, p.name]));
  const agentMap = new Map(agents.map(a => [a.id, a]));

  return agents.map((agent, i) => {
    const parent = agent.parent_agent_id ? agentMap.get(agent.parent_agent_id) : null;
    const directReports = agents.filter(a => a.parent_agent_id === agent.id);

    return {
      "#": i + 1,
      Name: agent.name,
      Mobile: agent.mobile,
      Role: ROLE_LABELS[agent.role],
      "Reports To": parent ? `${parent.name} (${ROLE_LABELS[parent.role]})` : "",
      "Direct Reports": directReports.length > 0 ? directReports.map(r => r.name).join(", ") : "",
      Panchayath: agent.panchayath?.name || panchayathMap.get(agent.panchayath_id) || "",
      Ward: agent.ward,
      "Customer Count": agent.role === "pro" ? agent.customer_count : "",
      Status: agent.is_active ? "Active" : "Inactive",
      "Created At": new Date(agent.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" }),
    };
  });
}

export function exportAgentsToXlsx(agents: PennyekartAgent[], panchayaths: PanchayathInfo[]) {
  const rows = buildRows(agents, panchayaths);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 5 },  // #
    { wch: 25 }, // Name
    { wch: 14 }, // Mobile
    { wch: 16 }, // Role
    { wch: 30 }, // Reports To
    { wch: 35 }, // Direct Reports
    { wch: 20 }, // Panchayath
    { wch: 8 },  // Ward
    { wch: 15 }, // Customer Count
    { wch: 10 }, // Status
    { wch: 14 }, // Created At
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Agents");

  const timestamp = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Pennyekart_Agents_${timestamp}.xlsx`);
}

export function exportAgentsToPdf(agents: PennyekartAgent[], panchayaths: PanchayathInfo[]) {
  const rows = buildRows(agents, panchayaths);

  const totalCustomers = agents
    .filter(a => a.role === "pro")
    .reduce((sum, a) => sum + a.customer_count, 0);

  // Build HTML table for PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Pennyekart Agents</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; color: #333; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; font-size: 11px; }
    .summary { display: flex; gap: 24px; margin-bottom: 16px; }
    .summary-item { font-weight: bold; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #d1d5db; font-size: 11px; white-space: nowrap; }
    td { padding: 5px 8px; border: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>Pennyekart Agents Report</h1>
  <div class="meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
  <div class="summary">
    <span class="summary-item">Total Agents: ${agents.length}</span>
    <span class="summary-item">Total Customers: ${totalCustomers}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Mobile</th><th>Role</th><th>Reports To</th><th>Direct Reports</th><th>Panchayath</th><th>Ward</th><th>Customers</th><th>Status</th><th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${r["#"]}</td><td>${r.Name}</td><td>${r.Mobile}</td><td>${r.Role}</td><td>${r["Reports To"]}</td><td>${r["Direct Reports"]}</td><td>${r.Panchayath}</td><td>${r.Ward}</td><td>${r["Customer Count"]}</td><td>${r.Status}</td><td>${r["Created At"]}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }
}
