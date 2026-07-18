import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampaignProgressBar, CampaignReadinessBadge, CampaignReadinessSummary } from '../../components/campaign-readiness/CampaignReadinessSummary';
import { evaluateCampaignReadiness } from '../campaignReadiness';

const result = evaluateCampaignReadiness({ campaign: { id: 'campaign-1', owner_id: 'owner-1', title: '', status: 'draft' } });

describe('campaign readiness components', () => {
  it('renders explicit progress semantics', () => {
    const html = renderToStaticMarkup(createElement(CampaignProgressBar, { value: 42 }));
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('42% complete');
  });

  it('renders status text without relying on color', () => {
    expect(renderToStaticMarkup(createElement(CampaignReadinessBadge, { result }))).toContain('Blocked');
  });

  it('renders one next action and an expandable checklist control', () => {
    const html = renderToStaticMarkup(createElement(CampaignReadinessSummary, { result }));
    expect(html).toContain('Add campaign name');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Checklist');
  });
});
