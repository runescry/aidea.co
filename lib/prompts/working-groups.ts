import type { CompanyIdentity, CMOOutput, CPOOutput, CFOOutput, CEODirective } from '@/types';

export function buildCopywriterPrompt(
  identity: CompanyIdentity,
  cmoOutput: CMOOutput,
  cpoOutput: CPOOutput,
  directive: CEODirective
): string {
  const features = cpoOutput.mvpFeatures.slice(0, 5).map(f => `${f.name}: ${f.description}`).join('\n- ');
  const messages = cmoOutput.keyMessages.join('\n- ');

  return `You are the Lead Copywriter for ${identity.name} — ${identity.tagline}.

Customer: ${identity.targetCustomer}
Value prop: ${identity.valueProposition}
Competitive edge: ${identity.competitiveEdge}

Key messages from CMO:
- ${messages}

MVP features:
- ${features}

CRITICAL RULE: Write every word as if this launches tomorrow. Zero placeholders. Zero [INSERT HERE]. Zero [CUSTOMER NAME]. Every sentence must be publication-ready. If you need an example name, invent one. If you need a testimonial, write it completely.

Deliver three artifacts:

1. COMPLETE landing page copy (every section)
2. THREE complete emails (full subject + body + CTA)
3. TWO complete ad variants (Meta + LinkedIn)

Return ONLY valid JSON with no preamble:
{
  "landingPageCopy": {
    "heroHeadline": "Under 8 words. Specific benefit. Not a generic claim.",
    "heroSubheadline": "1-2 sentences. Names the customer type and the outcome they get.",
    "heroCTA": "CTA button text (3-5 words)",
    "problemSection": "2-3 paragraphs describing the pain vividly. Names specific frustrations. Use second person (you/your).",
    "solutionSection": "2-3 paragraphs introducing ${identity.name}. Specific about what it does and how it works.",
    "featuresSection": [
      {
        "headline": "Feature benefit headline (not feature name)",
        "body": "2-3 sentences. Customer-centric. What changes for them.",
        "icon": "emoji that represents this"
      }
    ],
    "socialProofSection": "3 complete testimonials. Each has: full name, job title, company, and a specific quantified outcome they achieved.",
    "pricingTeaser": "One line about pricing. E.g. 'Starts free. No credit card required.' or 'From $29/month.'",
    "closingCTA": "2-3 sentences of closing copy + CTA button text.",
    "footerTagline": "Short tagline for footer. Under 10 words."
  },
  "emailSequence": [
    {
      "emailNumber": 1,
      "subject": "Complete subject line that gets opened",
      "previewText": "40-80 character preview text",
      "body": "Complete email body. 200-300 words. Personal and warm. Signed with a name.",
      "cta": "CTA text and what it links to",
      "sendTiming": "Immediately on signup"
    },
    {
      "emailNumber": 2,
      "subject": "Complete subject line",
      "previewText": "Preview text",
      "body": "Complete email body. 200-300 words. Teaches something valuable. Not salesy.",
      "cta": "CTA text",
      "sendTiming": "Day 3"
    },
    {
      "emailNumber": 3,
      "subject": "Complete subject line",
      "previewText": "Preview text",
      "body": "Complete email body. 200-300 words. Customer story + gentle nudge toward paid.",
      "cta": "CTA text",
      "sendTiming": "Day 7"
    }
  ],
  "adVariants": [
    {
      "platform": "meta",
      "headline": "Ad headline under 40 characters",
      "body": "100-125 words. Hook opens with the pain. Builds to the solution. Ends with social proof.",
      "cta": "CTA button text",
      "targetAudience": "Who this ad targets specifically",
      "hook": "The exact opening hook line"
    },
    {
      "platform": "linkedin",
      "headline": "LinkedIn headline under 50 characters",
      "body": "100-125 words. Professional tone. Peer-to-peer feel.",
      "cta": "CTA text",
      "targetAudience": "Professional targeting criteria",
      "hook": "Opening hook line"
    }
  ]
}`;
}

export function buildOutreachPrompt(
  identity: CompanyIdentity,
  cmoOutput: CMOOutput,
  cpoOutput: CPOOutput
): string {
  const audiences = cmoOutput.targetAudience.map(a => `${a.name}: ${a.description}`).join('\n- ');

  return `You are the Head of Outreach for ${identity.name} — ${identity.tagline}.

Customer: ${identity.targetCustomer}
Value prop: ${identity.valueProposition}
Key messages: ${cmoOutput.keyMessages.join(' | ')}

Target audiences:
- ${audiences}

Write 10 personalized cold outreach messages. Each should feel like it was written specifically for that person — not templated.

RULES:
- Do NOT use [FIRST NAME], [COMPANY], or any placeholder. Use realistic invented names (e.g., "Hey Sarah," "Hi Marcus,").
- First sentence hooks on a specific, observable pain the persona would recognize.
- Body is 120-180 words.
- CTA is low-friction: "Worth a reply if this resonates?", "Happy to send you a 2-minute demo video?", "Could this be worth 15 minutes?"
- 6 email messages, 4 LinkedIn messages
- Cover at least 4 different persona types from the target audiences above

Return ONLY valid JSON with no preamble:
{
  "messages": [
    {
      "personaType": "Specific job title + company type e.g. Head of Growth at B2B SaaS startup, Series A",
      "subjectLine": "Complete email subject line or null if LinkedIn",
      "openingLine": "The exact opening sentence. Specific hook on their world.",
      "body": "Full message body. 120-180 words. No placeholders. Real name in greeting.",
      "cta": "The exact ask. Low friction.",
      "channel": "email",
      "tonality": "peer-to-peer"
    }
  ]
}`;
}

export function buildPricingPrompt(
  identity: CompanyIdentity,
  cpoOutput: CPOOutput,
  cfoOutput: CFOOutput
): string {
  const features = cpoOutput.mvpFeatures.map(f => f.name).join(', ');

  return `You are the Pricing Designer for ${identity.name} — ${identity.tagline}.

Customer: ${identity.targetCustomer}
Value prop: ${identity.valueProposition}
Revenue model: ${cfoOutput.revenueModel}
Unit economics: CAC ${cfoOutput.unitEconomics.cac} | LTV ${cfoOutput.unitEconomics.ltv} | LTV/CAC ${cfoOutput.unitEconomics.ltvCacRatio}
Core product features: ${features}

Write a COMPLETE, production-ready HTML pricing page. It will be rendered live in an iframe on the dashboard.

Requirements:
- Full standalone HTML document with all CSS in a <style> tag (no external dependencies)
- Dark theme: background #0f172a, cards #1e293b, text #f8fafc, accent #6366f1
- 3 pricing tiers. Middle tier visually highlighted with a colored border and "Most Popular" badge.
- Feature comparison table with ✓ and — for each tier
- 5 FAQ items with questions and answers
- 2 trust signals (e.g., "SOC 2 compliant", "99.9% uptime", "Trusted by X companies")
- Use actual dollar amounts consistent with the CFO's financial model
- Professional, conversion-optimized layout

The htmlContent must be a complete valid HTML document. Escape it properly for JSON (use \\n for newlines inside the string).

Return ONLY valid JSON with no preamble:
{
  "htmlContent": "<!DOCTYPE html><html lang=\\"en\\"><head>...</head><body>...</body></html>",
  "tiers": [
    {
      "name": "Tier name",
      "price": "$X/mo",
      "billingPeriod": "monthly",
      "tagline": "Who this tier is for",
      "features": ["Feature 1 included", "Feature 2 included"],
      "cta": "CTA button text",
      "isHighlighted": false
    }
  ]
}`;
}

export function buildResearchPrompt(
  identity: CompanyIdentity,
  cpoOutput: CPOOutput,
  cmoOutput: CMOOutput
): string {
  const pains = cpoOutput.mvpFeatures.map(f => f.customerPain).join(' | ');

  return `You are the Customer Research Lead for ${identity.name} — ${identity.tagline}.

Customer: ${identity.targetCustomer}
Core hypothesis: ${identity.valueProposition}
Pain points we think they have: ${pains}
Target audiences: ${cmoOutput.targetAudience.map(a => a.name).join(', ')}

Write a complete customer discovery interview guide for 1:1 founder-to-customer calls.

This guide uncovers problem depth — it does NOT validate your solution. Questions should be about the customer's world, not your product.

Include:
1. Intro script (60 seconds, builds rapport, sets expectations)
2. 10 questions organized by theme
3. 2 follow-up probes per question
4. Outro script (captures referrals, sets next steps)
5. "What Good Looks Like" section: what answers validate vs invalidate the core hypothesis

The guideMarkdown should be ~1500 words formatted as a proper research document a founder would print out and use on a call.

Return ONLY valid JSON with no preamble:
{
  "guideMarkdown": "# Customer Discovery Guide: ${identity.name}\\n\\n## About This Guide\\n...complete markdown document ~1500 words...",
  "questions": [
    {
      "id": 1,
      "theme": "Theme name (e.g. Problem Discovery, Current Behavior, Decision Making)",
      "question": "The exact question to ask",
      "followUps": [
        "Follow-up probe 1 that digs deeper",
        "Follow-up probe 2 for a different angle"
      ],
      "rationale": "What this question uncovers and why it matters for validating or invalidating the hypothesis"
    }
  ]
}`;
}
