# Testimonial outreach — playbook

## Why this exists

The home-page `Testimonials` component was hidden on 2026-05-05 because
the placeholders (`[Sarah M.]`, `[Marcus T.]`, `[Jennifer L.]`) were
FTC-flag territory if Google indexed them as real endorsements. The
component code is still in the repo (`src/components/Testimonials.tsx`)
— ready to drop back in once we have real quotes to populate it.

The four real engagements TFB has trust-strip logos for:
**Costa Vida**, **High Point Coffee**, **Cyberbacker**, **Bajio
Mexican Grill**. Those are the first targets.

---

## Quote-collection email (paste into your email client)

**Subject:** `30 seconds — would you say something nice about us?`

**Body:**

> Hi [first name],
>
> Quick ask. We're cleaning up the testimonials section on
> thefranchisorblueprint.com and would love to feature [Brand] on
> the page if you're open to it.
>
> All I need is 1–3 sentences on what working with Jason actually
> changed for you — whatever's true. The most useful testimonials
> are concrete: a number you hit, a problem we unstuck, a moment
> you remember. If nothing comes to mind, no worries — happy with
> whatever you'd say to a peer asking about us.
>
> What I'd put on the site (with your approval before publishing):
>
> - Your name + title (or first name + last initial if you'd rather)
> - Brand name + city/state
> - The 1–3 sentence quote
> - Optional: 1 specific outcome ("3 units sold in X months",
>   "launched in 6", "saved $40K vs. firm quote") if you want to
>   frame it that way
>
> Reply with whatever feels right. If easier, I can send a draft
> based on what I remember from our work together and you just
> approve or edit.
>
> Thanks,
> Jason

---

## Workflow once a reply lands

1. **Eric drafts the testimonial** in the same shape as the
   placeholders in `src/components/Testimonials.tsx`:

   ```tsx
   {
     quote: "...",
     name: "Sarah M.",          // or full name with permission
     title: "Founder, Costa Vida · Salt Lake City, UT",
     outcome: "3 units sold in 4 months",  // optional pill
   }
   ```

2. **Send the draft back to the customer for approval.** Get explicit
   "yes, you can publish that" in writing — email is fine. FTC
   guidance treats published testimonials as the brand's
   responsibility, so a paper trail matters.

3. **Replace the corresponding placeholder** in the component, save,
   commit, push. (Ping Eric/Claude — file lives at
   `src/components/Testimonials.tsx`.)

4. **When all 3 placeholder slots have real quotes**, un-hide the
   testimonials section on the home page (`src/app/page.tsx` — the
   "===== 9. TESTIMONIALS — HIDDEN =====" comment marks the spot).

---

## What "good" testimonials look like

The current Tier 1 sample copy is decent shape — 2-3 sentences, one
concrete outcome. Aim for that:

> "We'd been quoted $62,000 by a big firm just for the documents.
> Jason got us franchise-ready for a fraction of that — and actually
> walked us through every step. We sold our first three franchises
> four months after launch."
> — Sarah M., Founder, Costa Vida

Avoid:

- Vague superlatives ("best consultant ever!") — reads as fake
- Specific income claims ("made $500K in 3 months") without an
  earnings disclaimer next to them — FTC issue
- Anything you can't back up with a paper trail if a customer
  inquired
