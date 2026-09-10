import { RemunerationEstimate, RemunerationStoryEstimate } from "./types";

export async function exportToExcel(
  projectName: string,
  estimate: RemunerationEstimate,
  stories: RemunerationStoryEstimate[]
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = [
    ["Project", projectName],
    ["Estimate Date", new Date(estimate.created_at).toLocaleDateString()],
    ["Currency", estimate.currency],
    ["Hourly Rate", estimate.hourly_rate],
    ["AI Estimated Hours", estimate.ai_total_hours],
    ["Final Hours", estimate.final_total_hours],
    ["Base Amount", estimate.base_amount],
    ["Contingency %", estimate.contingency_percentage],
    ["Contingency Amount", estimate.contingency_amount],
    ["Final Remuneration", estimate.final_amount],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Project Summary");

  // 2. Story Breakdown Sheet
  const breakdownData = stories.map((s) => ({
    Epic: s.epic_name || "Uncategorized",
    Story: s.story_title,
    Complexity: s.complexity,
    "Frontend Hours": s.frontend_hours,
    "Backend Hours": s.backend_hours,
    "Database Hours": s.database_hours,
    "Integration Hours": s.integration_hours,
    "Testing Hours": s.testing_hours,
    "AI Estimated Hours": s.ai_estimated_hours,
    "Final Hours": s.final_hours,
    "Story Amount": s.final_hours * estimate.hourly_rate,
    Confidence: s.confidence,
    Reasoning: s.reasoning,
  }));
  const breakdownWs = XLSX.utils.json_to_sheet(breakdownData);
  XLSX.utils.book_append_sheet(wb, breakdownWs, "Story Breakdown");

  // 3. Assumptions & Risks Sheet
  const assumptionsData: any[] = [];
  stories.forEach((s) => {
    s.assumptions?.forEach((a) => {
      assumptionsData.push({
        Epic: s.epic_name || "Uncategorized",
        Story: s.story_title,
        Type: "Assumption",
        Description: a,
      });
    });
    s.risks?.forEach((r) => {
      assumptionsData.push({
        Epic: s.epic_name || "Uncategorized",
        Story: s.story_title,
        Type: "Risk",
        Description: r,
      });
    });
  });
  
  if (assumptionsData.length === 0) {
    assumptionsData.push({ Epic: "-", Story: "-", Type: "None", Description: "No specific assumptions or risks." });
  }
  
  const assumptionsWs = XLSX.utils.json_to_sheet(assumptionsData);
  XLSX.utils.book_append_sheet(wb, assumptionsWs, "Assumptions & Risks");

  // Export
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `storyboard-${sanitizedName}-remuneration-${dateStr}.xlsx`);
}

export async function exportToPDF(
  projectName: string,
  estimate: RemunerationEstimate,
  stories: RemunerationStoryEstimate[]
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF();
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: estimate.currency,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("StoryBoard", 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("PROJECT REMUNERATION ESTIMATE", 14, 30);
  
  doc.setFontSize(10);
  doc.text(`Project: ${projectName}`, 14, 40);
  doc.text(`Generated: ${new Date(estimate.created_at).toLocaleDateString()}`, 14, 45);

  // Summary Table
  autoTable(doc, {
    startY: 55,
    head: [["Summary Item", "Value"]],
    body: [
      ["Stories", stories.length.toString()],
      ["Estimated Hours", estimate.final_total_hours.toString()],
      ["Hourly Rate", formatter.format(estimate.hourly_rate)],
      ["Base Remuneration", formatter.format(estimate.base_amount)],
      ["Contingency", `${estimate.contingency_percentage}%`],
      ["Final Estimate", formatter.format(estimate.final_amount)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [184, 148, 78] },
  });

  // Group by Epic
  const epics = stories.reduce((acc, story) => {
    const epicName = story.epic_name || "Uncategorized";
    if (!acc[epicName]) {
      acc[epicName] = { stories: [], totalHours: 0 };
    }
    acc[epicName].stories.push(story);
    acc[epicName].totalHours += story.final_hours;
    return acc;
  }, {} as Record<string, { stories: RemunerationStoryEstimate[], totalHours: number }>);

  let finalY = (doc as any).lastAutoTable.finalY + 15;

  Object.entries(epics).forEach(([epicName, epicData]) => {
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Epic: ${epicName}`, 14, finalY);
    
    const epicAmount = epicData.totalHours * estimate.hourly_rate;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total: ${epicData.totalHours} hours - ${formatter.format(epicAmount)}`, 14, finalY + 5);

    const tableBody = epicData.stories.map(s => [
      s.story_title || "-",
      s.complexity,
      s.final_hours.toString(),
      formatter.format(s.final_hours * estimate.hourly_rate)
    ]);

    autoTable(doc, {
      startY: finalY + 10,
      head: [["Story", "Complexity", "Hours", "Amount"]],
      body: tableBody,
      theme: 'plain',
      styles: { cellPadding: 2, fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
  });

  if (finalY > 250) {
    doc.addPage();
    finalY = 20;
  }

  // Disclaimer
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const disclaimer = "Disclaimer: This estimate is based on the currently documented scope and assumptions. Changes to requirements, integrations, technical constraints, or project scope may affect the final effort and remuneration.";
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 28);
  doc.text(splitDisclaimer, 14, finalY + 10);

  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`storyboard-${sanitizedName}-remuneration-${dateStr}.pdf`);
}
