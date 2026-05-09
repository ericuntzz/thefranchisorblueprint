# Schema Audit Framework

**Purpose.** The 11 audit-pending section schemas in `src/lib/memory/schemas.ts` were designed from FDD requirements + general franchise practice. They have NOT been cross-checked against TFB's existing deliverable templates or the High Point Coffee reference bundle. This document is the tracking artifact for that audit.

**The rule.** From the schema file header: *"If I see a field that doesn't obviously map to an FDD item or a customer-facing deliverable, that's not grounds to cut it — that's grounds to ASK whether the existing TFB framework already covers it."* Default to inclusion. Cuts require Jason's sign-off; adds need a citation in a source document.

**How to use.** For each section below, walk the listed source documents section-by-section and fill in the **Add / Cut / Keep** table. Anything cut needs a one-line reason. Anything added needs a target field type + bucket placement note.

**Source document locations** (in Google Drive `The Franchisor Blueprint/`):
- `04_Customer_Deliverables/` — TFB's master templates (the v2 deliverables Jason has refined over multiple engagements)
- `High Point Coffee/` — the most complete reference bundle, an actual production engagement
- `99_Archive_Old_Versions/` — older drafts; reference only when the v2 lacks a section

---

## Foundational schemas (already audited — Jason+Eric aligned)

These are not in scope for this pass. Listed for completeness:

- `business_overview` (15 fields, light hybrid)
- `unit_economics` (22 fields, heavy structured)
- `franchise_economics` (21 fields, heavy structured)
- `franchisee_profile` (20 fields, heavy structured)
- `brand_voice` (8 fields, light hybrid — Phase 1.5b, recently landed)

---

## Audit-pending schemas

### 1. `vendor_supply_chain` — Approved Suppliers (13 fields)

**Source documents:**
- `High Point Coffee/HP_Franchise_Operations_Manual_v3_0.docx` — §14 Approved Suppliers
- `04_Customer_Deliverables/Universal Franchise Operations Manual Master Template.docx` — Procurement section
- `High Point Coffee/HP_Location_BuildOut_Manual_v2.docx` — Procurement appendix

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Approved vendors list | ✅ `approved_vendors` | Keep |
| Backup / alternate vendors | ✅ `alternate_vendors` | Keep |
| Required-source items (FDD Item 8) | ✅ `exclusive_purchase_required_items` | Keep |
| Locally-sourceable items | ✅ `items_franchisee_can_source_locally` | Keep |
| Rebate disclosures | ✅ `rebate_arrangements` | Keep |
| Order frequency rules | ✅ `minimum_order_frequency` | Keep |
| Inventory mgmt system | ✅ `inventory_management_system` | Keep |
| Vendor change approval | ✅ `vendor_change_approval_process` | Keep |
| Spec / quality standards | ✅ `quality_inspection_cadence`, `spec_documents` | Keep |
| Payment terms | ✅ `preferred_payment_terms` | Keep |
| Centralized purchasing | ✅ `centralized_purchasing_required` | Keep |
| _(Jason: anything in HP Ops Manual §14 not above?)_ | ⚠️ TBD | Add list below |

**Adds (Jason, fill in):**
-

**Cuts (Jason, fill in with reason):**
-

---

### 2. `marketing_fund` — Marketing Fund Governance (15 fields)

**Source documents:**
- `04_Customer_Deliverables/Universal Franchise Operations Manual Master Template.docx` — Marketing Fund section
- `High Point Coffee/HP_Franchise_Operations_Manual_v3_0.docx` — Marketing Fund section
- `04_Customer_Deliverables/Premium 23-Item Franchise Disclosure Document Guide.docx` — Item 11 guidance

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Governance model (franchisor / advisory / co-op) | ✅ `fund_governance_model` | Keep |
| Advisory board structure | ✅ `advisory_board_size`, `board_election_method`, `board_term_length_years` | Keep |
| Approved uses | ✅ `approved_uses` | Keep |
| Excluded uses | ✅ `excluded_uses` | Keep |
| Brand-spend minimum | ✅ `minimum_brand_spend_pct` | Keep |
| Reporting cadence | ✅ `reporting_cadence` | Keep |
| Audit requirements | ✅ `audit_required`, `audit_frequency` | Keep |
| Carryover policy | ✅ `carryover_policy` | Keep |
| Local marketing rules | ✅ `local_marketing_spend_required`, `local_marketing_pre_approval_required` | Keep |
| Grand-opening campaign | ✅ `grand_opening_marketing_required` | Keep |
| _Jason: missing from HP Marketing Fund section?_ | ⚠️ TBD |  |

**Adds:**
-

**Cuts:**
-

---

### 3. `employee_handbook` — Employee Handbook (17 fields)

**Source documents:**
- `High Point Coffee/HP_Employee_Handbook_v2.docx` — primary reference
- `04_Customer_Deliverables/Universal Franchise Operations Manual Master Template.docx` — People Management section

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Hours / scheduling | ✅ `standard_full_time_hours_per_week`, `minimum_shifts_per_week`, `scheduling_software` | Keep |
| Wage floor | ✅ `minimum_starting_wage_dollars_per_hour` | Keep |
| Tip pooling | ✅ `tip_pooling_policy` | Keep |
| Performance reviews | ✅ `performance_review_cadence` | Keep |
| PTO + sick days | ✅ `pto_days_per_year`, `paid_sick_days_per_year` | Keep |
| Holidays | ✅ `paid_holidays` | Keep |
| Health benefits | ✅ `health_benefits_offered` | Keep |
| Retirement | ✅ `retirement_benefits_offered` | Keep |
| Uniforms | ✅ `uniform_requirements` | Keep |
| Customer service standards | ✅ `customer_service_standards` | Keep |
| Social media policy | ✅ `social_media_policy` | Keep |
| Non-compete | ✅ `non_compete_required` | Keep |
| At-will language | ✅ `at_will_employment_required` | Keep |
| Termination appeal | ✅ `termination_appeal_process` | Keep |
| _Jason: anti-harassment, anti-discrimination, drug-free workplace, FMLA?_ | ⚠️ TBD | Likely adds |
| _Background-check policy at hire?_ | ⚠️ TBD |  |
| _Workplace safety / OSHA acknowledgment?_ | ⚠️ TBD |  |

**Adds (likely):**
- `anti_harassment_policy_acknowledged` (boolean) — required in most state employment law
- `drug_free_workplace_policy` (boolean) — federal contractor implication
- `fmla_compliance_threshold` — applies at 50+ employees

**Cuts:**
-

---

### 4. `reimbursement_policy` — Expense Reimbursement (10 fields)

**Source documents:**
- `High Point Coffee/HPMF_Reimbursement_Policy_v1_0.docx` — primary reference
- `High Point Coffee/HPMF_Policy_and_Procedure_Manual_v1_0.docx` — adjacent context

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Mileage rate | ✅ `mileage_rate_dollars_per_mile` | Keep |
| Meal per diem | ✅ `meal_per_diem_dollars` | Keep |
| Lodging per diem | ✅ `lodging_per_diem_dollars` | Keep |
| Airfare class | ✅ `airfare_class` | Keep |
| Single-expense approval threshold | ✅ `single_expense_approval_threshold_dollars` | Keep |
| Monthly cap | ✅ `monthly_expense_cap_dollars` | Keep |
| Non-reimbursable categories | ✅ `non_reimbursable_categories` | Keep |
| Reporting tool | ✅ `expense_reporting_software` | Keep |
| Receipt threshold | ✅ `receipt_required_threshold_dollars` | Keep |
| Payment schedule | ✅ `reimbursement_payment_schedule` | Keep |
| _Jason: cell phone allowance? Home office? Per-diem location-based variance?_ | ⚠️ TBD |  |

**Adds:**
-

**Cuts:**
-

---

### 5. `compliance_legal` — FDD Posture & State Strategy (12 fields)

**Source documents:**
- `04_Customer_Deliverables/Premium 23-Item Franchise Disclosure Document Guide.docx`
- `High Point Coffee/HP_Document_Review_Franchise_Audit.docx`
- `High Point Coffee/LMF_FDD_Guide.docx`
- `High Point Coffee/LMF-Comprehensive Franchise System Development Fact-Finding Checklist.docx`

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| State registration prioritization | ✅ `registration_states` | Keep |
| Filing-only states | ✅ `filing_only_states` | Keep |
| Non-registration states | ✅ `non_registration_states` | Keep |
| Exemption strategy | ✅ `exemption_strategy` | Keep |
| Attorney info | ✅ `attorney_name`, `attorney_firm`, `attorney_email`, `attorney_phone` | Keep |
| FDD timeline | ✅ `fdd_target_completion_date`, `first_franchisee_target_date` | Keep |
| Insurance requirements | ✅ `general_liability_minimum_dollars`, `additional_insurance_required` | Keep |
| _Jason: trademark filing status? Entity formation type? Corporate counsel separate from franchise counsel?_ | ⚠️ TBD | Likely adds |
| _Audit firm for Item 21 financials?_ | ⚠️ TBD |  |
| _Item 19 strategy (FPR yes/no)?_ | ⚠️ TBD |  |
| _Renewal posture (uniform vs. negotiated)?_ | ⚠️ TBD |  |

**Adds (likely):**
- `trademark_status` (select: not_filed / filed / registered)
- `entity_formation_type` (select: LLC / S-corp / C-corp)
- `corporate_counsel` (text — separate from franchise counsel)
- `audit_firm` (text — for Item 21)
- `item_19_fpr_strategy` (select: full / partial / none)

**Cuts:**
-

---

### 6. `operating_model` — Daily Operations (7 fields)

**Source documents:**
- `04_Customer_Deliverables/Universal Franchise Operations Manual Master Template.docx` — §3-12
- `High Point Coffee/HP_Franchise_Operations_Manual_v3_0.docx` — Daily Operations

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Hours of operation | ✅ `standard_hours_of_operation` | Keep |
| Peak hours | ✅ `peak_hours` | Keep |
| Staffing levels | ✅ `staff_per_shift_typical`, `staff_per_shift_peak` | Keep |
| Daily KPIs | ✅ `key_kpis_tracked_daily` | Keep |
| Open/close rituals | ✅ `daily_rituals` | Keep |
| Required software | ✅ `operations_software_required` | Keep |
| _Jason: shift handoff procedure? Cash-handling procedure? Manager-on-duty rules? Inventory cycle counts?_ | ⚠️ TBD |  |

**Note:** This is a light-hybrid section — much of the operational detail lives in the prose `content_md`. Audit should distinguish "needs structured field" from "fine in prose."

**Adds (likely structured):**
- `cash_handling_procedure_required` (boolean)
- `inventory_cycle_count_frequency` (select)

**Cuts:**
-

---

### 7. `recipes_and_menu` — Product & Service Specs (7 fields)

**Source documents:**
- `04_Customer_Deliverables/Universal Franchise Operations Manual Master Template.docx` — §13
- `High Point Coffee/HP_Franchise_Operations_Manual_v3_0.docx` — Product Specs
- `High Point Coffee/HP_Barista_Certification_Program_v2_1.docx` — recipe IP

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Menu count | ✅ `menu_item_count` | Keep |
| Signature items | ✅ `signature_items` | Keep |
| Price range | ✅ `price_range_low_dollars`, `price_range_high_dollars` | Keep |
| Average ticket | ✅ `average_ticket_dollars` | Keep |
| Pricing strategy | ✅ `pricing_strategy` | Keep |
| Spec book status | ✅ `recipe_book_status` | Keep |
| _Jason: seasonal/LTO menu cadence? Allergen disclosure standards? Plating/presentation standards?_ | ⚠️ TBD |  |

**Adds:**
-

**Cuts:**
-

---

### 8. `training_program` — Training & Certification (10 fields)

**Source documents:**
- `High Point Coffee/HP_Barista_Certification_Program_v2_1.docx` — primary reference
- `04_Customer_Deliverables/Premium 23-Item Franchise Disclosure Document Guide.docx` — Item 11

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Initial training duration | ✅ `initial_training_duration_days` | Keep |
| Format | ✅ `initial_training_format` | Keep |
| Required attendees | ✅ `initial_training_attendees` | Keep |
| Travel cost responsibility | ✅ `training_travel_at_franchisee_expense` | Keep |
| Opening support | ✅ `opening_support_days_on_site`, `opening_support_team_size` | Keep |
| Ongoing training | ✅ `ongoing_training_required` | Keep |
| Annual conference | ✅ `annual_conference_required` | Keep |
| Certification | ✅ `certification_required`, `certification_levels` | Keep |
| _Jason: refresher cadence? Cert expiration window? Train-the-trainer model? LMS used?_ | ⚠️ TBD |  |

**Adds (likely):**
- `certification_renewal_period_months` (integer)
- `train_the_trainer_model` (boolean)
- `lms_platform` (text — what's the LMS, e.g., Trainual, Lessonly)

**Cuts:**
-

---

### 9. `territory_real_estate` — Site Selection & Territory (9 fields)

**Source documents:**
- `04_Customer_Deliverables/Franchise Site Selection and Build-Out Guide.docx`
- `High Point Coffee/HP_Site_Selection_BuildOut_Guide.docx`
- `High Point Coffee/HP_Site_Evaluation_Report.docx`
- `High Point Coffee/HP_Salt_Lake_Site_Broker_Scorecard.docx`

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Trade-area population | ✅ `ideal_population_per_unit` | Keep |
| Income threshold | ✅ `ideal_household_income_min_dollars` | Keep |
| Footprint range | ✅ `target_square_footage_low`, `target_square_footage_high` | Keep |
| Site type preferences | ✅ `site_type_preferences` | Keep |
| Priority markets | ✅ `priority_geographic_markets` | Keep |
| Exclusion zones | ✅ `exclusion_zones` | Keep |
| Site approval process | ✅ `site_approval_required`, `site_approval_timeline_days` | Keep |
| _Jason: Co-tenancy preferences? Daytime population vs residential? Drive-time radius? Parking minimums? Visibility requirements? Anchor-tenant adjacency rules?_ | ⚠️ TBD | Many likely adds |

**Adds (likely — site-broker scorecard depth):**
- `daytime_population_target` (integer)
- `parking_spots_minimum` (integer)
- `visibility_requirement` (textarea — e.g., "200ft setback, signage from main road")
- `co_tenancy_preferences` (list_short)
- `anchor_tenant_proximity_required` (boolean)
- `drive_time_radius_minutes` (integer — alternative/supplement to mile radius)

**Cuts:**
-

---

### 10. `market_strategy` — Market Strategy & Positioning (5 fields)

**Source documents:**
- `High Point Coffee/HP_Utah_Market_Strategy_Report.docx`
- `04_Customer_Deliverables/Franchise Development Strategy and 12-Month Gantt Chart.docx`

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Growth horizon | ✅ `growth_horizon_years` | Keep |
| Unit count targets | ✅ `target_unit_count_year_3`, `target_unit_count_year_5` | Keep |
| Competitive positioning | ✅ `competitive_positioning_summary` | Keep |
| Expansion sequencing | ✅ `expansion_sequencing_strategy` | Keep |
| _Jason: pilot-market criteria? Market-entry economics (per-market hurdle)? National rollout criteria?_ | ⚠️ TBD |  |

**Note:** Agent-research-drafted bucket. Most of the substance is in the agent-generated prose; structured fields are anchors only. Likely doesn't need many adds.

**Adds:**
-

**Cuts:**
-

---

### 11. `competitor_landscape` — Competitive Landscape (5 fields)

**Source documents:**
- `High Point Coffee/HP_Competitor_Maps_Appendix_Branded.pptx`
- `04_Customer_Deliverables/Premium Franchise Investment Prospectus and Financial Model.docx` — competitive section

**Cross-check:**
| Source section | In schema? | Action |
|---|---|---|
| Direct competitors | ✅ `direct_competitors` | Keep |
| Indirect competitors | ✅ `indirect_competitors` | Keep |
| Competitive advantages | ✅ `competitive_advantages` | Keep |
| Vulnerabilities | ✅ `competitive_vulnerabilities` | Keep |
| Research notes | ✅ `competitive_research_notes` | Keep |
| _Jason: substitute categories (different industry, same job-to-be-done)? National chains entering the market?_ | ⚠️ TBD |  |

**Adds:**
-

**Cuts:**
-

---

## Summary template (fill at end of audit)

**Total fields before audit:** ~150 across 11 schemas
**Adds proposed:** _N_
**Cuts proposed:** _N_
**Net field count after audit:** _N_
**Schemas requiring follow-up Jason call:** _list_
**Field renames required:** _list with migration plan_

## Migration plan for renames

If the audit surfaces field renames, each one needs:
1. New field added next to old field in `schemas.ts`
2. One-shot script: `fields[new_name] = fields[old_name]; delete fields[old_name]` for every customer_memory row
3. Old field removed from `schemas.ts`
4. Any references in `src/lib/calc/`, `src/lib/memory/industry-lookup.ts`, `src/lib/agent/extract-fields.ts` updated

Renames are destructive — avoid if a new field name can be added alongside instead.
