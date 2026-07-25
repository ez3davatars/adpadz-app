import type { CampaignTemplateContent, CampaignTemplateSettings, TemplateReadinessIssue } from "./types";

export function evaluateTemplateReadiness(
  content: CampaignTemplateContent,
  settings: CampaignTemplateSettings,
): { ready: boolean; blockers: TemplateReadinessIssue[]; warnings: TemplateReadinessIssue[] } {
  const issues: TemplateReadinessIssue[] = [];
  if (!content.businessName || content.businessName === "Local business") issues.push(issue("business_name", "blocker", "Add the business name."));
  if (!content.headline) issues.push(issue("headline", "blocker", "Add a campaign headline."));
  if (!content.imageUrl) issues.push(issue("image", "warning", "Add a campaign image for the strongest result."));
  if (settings.template === "offer-first" && !content.offer) issues.push(issue("offer", "blocker", "Offer First requires an offer title."));
  if (settings.template === "brand-focus" && !content.businessLogoUrl) issues.push(issue("logo", "blocker", "Brand Focus requires a business logo."));
  if (settings.showQr && !content.destinationUrl) issues.push(issue("qr", "blocker", "Choose a destination before showing a QR code."));
  if (settings.showExpiration && !content.expiration) issues.push(issue("expiration", "warning", "No expiration date is set."));
  const blockers = issues.filter(item => item.severity === "blocker");
  return { ready: blockers.length === 0, blockers, warnings: issues.filter(item => item.severity === "warning") };
}

function issue(field: TemplateReadinessIssue["field"], severity: TemplateReadinessIssue["severity"], message: string): TemplateReadinessIssue {
  return { field, severity, message };
}

