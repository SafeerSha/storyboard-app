import { RemunerationEstimate, RemunerationStoryEstimate } from "./types";

export async function exportToExcel(
  projectName: string,
  estimate: RemunerationEstimate,
  stories: RemunerationStoryEstimate[]
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const summary = estimate.project_summary || {};
  const scopeLabel = summary.scope === "frontend" 
    ? "Frontend Only" 
    : summary.scope === "backend" 
    ? "Backend Only" 
    : "Full Stack (Both)";
  const dbDesignLabel = summary.includeDbDesign ? "Included" : "Excluded";
  const unitTestingLabel = summary.includeUnitTesting !== false ? "Included" : "Excluded";
  const deploymentLabel = summary.includeDeployment 
    ? `Included (${summary.deploymentHours || 0} hrs)` 
    : "Excluded";

  // 1. Summary Sheet
  const summaryData = [
    ["Project", projectName],
    ...(summary.estimate_label ? [["Milestone / Phase", summary.estimate_label]] : []),
    ["Estimate Date", new Date(estimate.created_at).toLocaleDateString()],
    ["Currency", estimate.currency],
    ["Scope of Work", scopeLabel],
    ["Database Design", dbDesignLabel],
    ["Unit Testing", unitTestingLabel],
    ["Deployment & DevOps", deploymentLabel],
    ["Base Hourly Rate", estimate.hourly_rate],
    ["Effective Hourly Rate", summary.rates?.effectiveRate || estimate.hourly_rate],
    ["Total Stories", stories.length],
    ["Base Estimated Hours", estimate.ai_total_hours],
    ["Final Billable Hours", estimate.final_total_hours],
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
    Story: s.story_title || (s as any).title || "Story",
    Complexity: s.complexity,
    "Frontend Hours": s.frontend_hours,
    "Backend Hours": s.backend_hours,
    "Database Hours": s.database_hours,
    "Unit Testing Hours": s.testing_hours,
    "Integration Hours": s.integration_hours,
    "Estimated Hours": s.ai_estimated_hours,
    "Final Hours": s.final_hours,
    "Story Amount": s.final_hours * (summary.rates?.effectiveRate || estimate.hourly_rate),
    Confidence: s.confidence,
    Reasoning: s.reasoning,
  }));

  // If deployment is included, add deployment deliverable row
  if (summary.includeDeployment && (summary.deploymentHours || 0) > 0) {
    const deployRate = summary.rates?.deployment || estimate.hourly_rate;
    breakdownData.push({
      Epic: "DevOps & Infrastructure",
      Story: "Cloud Provisioning, CI/CD Pipeline & Deployment",
      Complexity: "Medium",
      "Frontend Hours": 0,
      "Backend Hours": 0,
      "Database Hours": 0,
      "Unit Testing Hours": 0,
      "Integration Hours": 0,
      "Estimated Hours": summary.deploymentHours || 0,
      "Final Hours": summary.deploymentHours || 0,
      "Story Amount": (summary.deploymentHours || 0) * deployRate,
      Confidence: "High",
      Reasoning: "Dedicated cloud hosting setup, pipeline, domain/SSL configuration, and production release verification.",
    });
  }

  const breakdownWs = XLSX.utils.json_to_sheet(breakdownData);
  XLSX.utils.book_append_sheet(wb, breakdownWs, "Story Breakdown");

  // Export
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const labelSuffix = summary.estimate_label ? `-${summary.estimate_label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}` : "";
  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `${sanitizedName}${labelSuffix}-quotation-${dateStr}.xlsx`);
}

export async function buildRemunerationPDFDoc(
  projectName: string,
  estimate: any,
  stories: any[]
) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF();
  const formatCurrency = (val: number) => {
    return `${estimate.currency || "USD"} ${val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const summary = estimate.project_summary || {};
  const scopeLabel = summary.scope === "frontend" 
    ? "Frontend Only" 
    : summary.scope === "backend" 
    ? "Backend Only" 
    : "Full Stack (Both)";
  const dbDesignLabel = summary.includeDbDesign ? "Included" : "Excluded";
  const unitTestingLabel = summary.includeUnitTesting !== false ? "Included" : "Excluded";
  const deploymentLabel = summary.includeDeployment 
    ? `Included (${summary.deploymentHours || 0} hrs)` 
    : "Excluded";
  const effectiveRate = summary.rates?.effectiveRate || estimate.hourly_rate;
  
  const estimateLabel = summary.estimate_label;
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27);
  doc.text("SCOPE & REMUNERATION PROPOSAL", 14, 20);
  
  doc.setFontSize(11);
  doc.setTextColor(70, 70, 70);
  doc.text(`Project: ${projectName}${estimateLabel ? `  •  ${estimateLabel}` : ""}`, 14, 28);
  
  const estimateDate = estimate.created_at ? new Date(estimate.created_at).toLocaleDateString() : new Date().toLocaleDateString();
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(`Date: ${estimateDate}${estimateLabel ? `  |  Milestone: ${estimateLabel}` : ""}`, 14, 34);

  // Summary Table
  const summaryBody = [
    ...(estimateLabel ? [["Milestone / Phase", estimateLabel]] : []),
    ["Engineering Scope", scopeLabel],
    ["Database Design", dbDesignLabel],
    ["Unit Testing", unitTestingLabel],
    ["Deployment & DevOps", deploymentLabel],
    ["Total Stories", (stories.length || 0).toString()],
    ["Estimated Hours", `${estimate.final_total_hours} hrs`],
    ["Base Hourly Rate", formatCurrency(estimate.hourly_rate || 0)],
    ["Effective Hourly Rate", formatCurrency(effectiveRate || 0)],
    ["Base Remuneration", formatCurrency(estimate.base_amount || 0)],
    ["Contingency", `${estimate.contingency_percentage || 0}% (${formatCurrency(estimate.contingency_amount || 0)})`],
    ["Final Expected Remuneration", formatCurrency(estimate.final_amount || 0)],
  ];

  autoTable(doc, {
    startY: 42,
    head: [["Summary Item", "Value"]],
    body: summaryBody,
    theme: 'grid',
    headStyles: { fillColor: [184, 148, 78] },
  });

  // Group by Epic
  const epics = (stories || []).reduce((acc: any, story: any) => {
    const epicName = story.epic_name || "Uncategorized";
    if (!acc[epicName]) {
      acc[epicName] = { stories: [], totalHours: 0 };
    }
    acc[epicName].stories.push(story);
    acc[epicName].totalHours += Number(story.final_hours || 0);
    return acc;
  }, {} as Record<string, { stories: any[], totalHours: number }>);

  let finalY = (doc as any).lastAutoTable.finalY + 15;

  Object.entries(epics).forEach(([epicName, epicData]: [string, any]) => {
    if (finalY > 240) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Epic: ${epicName}`, 14, finalY);
    
    const epicAmount = epicData.totalHours * effectiveRate;
    const roundedHours = Number(epicData.totalHours.toFixed(2));
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total: ${roundedHours} hours - ${formatCurrency(epicAmount)}`, 14, finalY + 5);

    const tableBody = epicData.stories.map((s: any) => [
      s.story_title || s.title || "-",
      s.complexity || "Medium",
      `${s.final_hours || 0} hrs`,
      formatCurrency((s.final_hours || 0) * effectiveRate)
    ]);

    autoTable(doc, {
      startY: finalY + 8,
      head: [["Story", "Complexity", "Hours", "Amount"]],
      body: tableBody,
      theme: 'plain',
      styles: { cellPadding: 2, fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
  });

  // Deployment Section if included
  if (summary.includeDeployment && (summary.deploymentHours || 0) > 0) {
    if (finalY > 240) {
      doc.addPage();
      finalY = 20;
    }

    const deployRate = summary.rates?.deployment || effectiveRate;
    const deployAmount = (summary.deploymentHours || 0) * deployRate;

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("DevOps & Cloud Deployment", 14, finalY);

    autoTable(doc, {
      startY: finalY + 8,
      head: [["Deliverable", "Description", "Hours", "Amount"]],
      body: [
        [
          "Cloud Provisioning & CI/CD",
          "Production infrastructure, CI/CD pipeline, environment secrets, domain/SSL verification.",
          `${summary.deploymentHours} hrs`,
          formatCurrency(deployAmount)
        ]
      ],
      theme: 'plain',
      styles: { cellPadding: 2, fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
  }

  if (finalY > 250) {
    doc.addPage();
    finalY = 20;
  }

  // Disclaimer
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  const disclaimer = `Disclaimer: This estimate is based on the selected scope (${scopeLabel}, Database Design: ${dbDesignLabel}, Unit Testing: ${unitTestingLabel}, Deployment: ${deploymentLabel}). Changes to requirements, third-party integrations, infrastructure constraints, or client revisions may affect the final effort and remuneration.`;
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 28);
  doc.text(splitDisclaimer, 14, finalY + 6);

  return doc;
}

export async function exportToPDF(
  projectName: string,
  estimate: RemunerationEstimate,
  stories: RemunerationStoryEstimate[]
) {
  const doc = await buildRemunerationPDFDoc(projectName, estimate, stories);
  const summary = estimate.project_summary || {};
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const labelSuffix = summary.estimate_label ? `-${summary.estimate_label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}` : "";
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`${sanitizedName}${labelSuffix}-quotation-${dateStr}.pdf`);
}

export async function generateRemunerationPDFBuffer(
  projectName: string,
  estimate: any,
  stories: any[]
): Promise<Buffer> {
  const doc = await buildRemunerationPDFDoc(projectName, estimate, stories);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
