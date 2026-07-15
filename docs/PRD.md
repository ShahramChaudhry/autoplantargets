# AutoPlan Targets — Product Requirements Document (MVP)

**Document version:** 1.0  
**Audience:** Executive leadership, business sponsors, project approvers  
**Status:** Approved for MVP delivery  

---

## 1. Executive Summary

### Purpose

AutoPlan Targets is a digital planning platform for automotive sales organizations. It replaces fragmented spreadsheets and email-based approvals with a single, governed workflow for setting monthly sales targets and distributing them from national level down to individual sales executives.

### Business Problem

Today, monthly target planning is slow, opaque, and error-prone. Targets are created in isolation, approvals lack a clear audit trail, and downstream allocation to sales offices and executives is difficult to reconcile. Leadership cannot easily confirm that national retail targets match what has been assigned in the field.

AutoPlan Targets addresses this by providing one system of record for the full monthly planning cycle—from target creation through executive approval, retail distribution, and automatic reconciliation.

### Scope of the MVP

The MVP delivers a complete end-to-end monthly planning cycle for a single organization, including:

- Creation and management of **Monthly Target Plans**
- Target entry by **brand** and **sales group** (Retail, Fleet, Corporate Fleet)
- **Model** and **article-level** allocation for Demand & Supply planning
- **Two-stage executive approval** (B2B Director, then Managing Director)
- **Sales Office allocation** for Retail targets only
- **Executive allocation** by Branch Managers
- **Automatic reconciliation** across planning layers
- **Notifications** for approvals, change requests, and reconciliation issues
- **Audit history** of key actions and decisions

Out of scope for the MVP: integration with ERP or DMS systems, multi-country rollouts, forecasting, and mobile-native applications.

---

## 2. Users & Roles

| Role | Primary Responsibility |
|------|------------------------|
| **Demand & Supply Team** | Owns monthly plan creation, target entry, model/article allocation, submission for review, and finalization after MD approval |
| **B2B Director** | Reviews submitted plans; approves or requests changes before MD review |
| **Managing Director (MD)** | Provides final executive approval or requests changes |
| **National Performance Manager / Retail Head** | Distributes approved Retail targets across sales offices and confirms sales office allocation is complete |
| **Branch Manager** | Assigns sales office targets to individual sales executives within their branch |

Each role accesses only the parts of the workflow relevant to their responsibilities. The system enforces role-based access so users cannot perform actions outside their authority.

---

## 3. Future-State Business Process

The following describes the intended monthly planning cycle from start to finish.

### Phase 1 — Plan Creation (Demand & Supply Team)

1. **Create Monthly Target Plan** for a specific month and year.
2. **Create Targets** by brand and sales group (Retail, Fleet, Corporate Fleet).
3. **Allocate Targets to Models** within each brand target.
4. **Allocate Targets to Articles** within each model allocation.
5. **Review and Submit** the plan for B2B review when targets and allocations are complete.

### Phase 2 — B2B Review (B2B Director)

6. Review the submitted plan, target summary, and allocation detail.
7. **Approve** the plan or **Request Changes** with comments.

**If approved:** the plan is **automatically routed to MD Review**—no manual handoff is required.

**If changes are requested:** the plan returns to the Demand & Supply Team for correction and resubmission.

### Phase 3 — MD Approval (Managing Director)

8. Review the plan after B2B approval.
9. **Approve** the plan or **Request Changes** with comments.

**If approved:** the Demand & Supply Team is notified and may **Finalize** the plan.

**If changes are requested:** the plan returns to the Demand & Supply Team for correction and resubmission.

### Phase 4 — Finalization (Demand & Supply Team)

10. **Finalize** the approved plan, locking all targets and allocations and releasing the plan for downstream retail distribution.

### Phase 5 — Sales Office Allocation (National Performance Manager / Retail Head)

11. **Allocate Retail targets** to sales offices (e.g., Dubai, Abu Dhabi, Sharjah).
12. Monitor allocation progress until the full Retail target is distributed.
13. **Mark Sales Office Allocation complete** when all Retail units are fully assigned. This locks office allocations and notifies Branch Managers that executive allocation may begin.

### Phase 6 — Executive Allocation (Branch Manager)

14. **Allocate sales office targets** to individual sales executives.
15. Update allocations as needed until office-level and executive-level totals align.

### Phase 7 — Reconciliation & Completion (System)

16. The system **automatically validates reconciliation** across three layers:
    - Total **Model Targets for Retail**
    - Total **Sales Office Targets**
    - Total **Executive Allocations**

17. **If reconciliation passes:** the Monthly Target Plan is marked **Completed**.

18. **If reconciliation fails:** the system sends a **notification** to the Branch Manager identifying the mismatch. Allocations may be corrected and the system re-validates until reconciliation passes.

---

## 4. Key Business Rules

### Target & Allocation Rules

- **Only Retail targets** are allocated to sales offices. Fleet and Corporate Fleet targets are planned at the Demand & Supply level but do not participate in Sales Office or Executive allocation.
- Model and article allocations must remain consistent with their parent brand targets.
- Sales Office allocation is complete only when the sum of all office allocations **equals** the total Retail target.

### Plan Editability & Locking

- Plans are **editable** only in **Draft** or **Changes Requested** states (after B2B or MD has returned the plan).
- Plans become **locked** when submitted for review and remain locked through approval stages.
- After MD approval, finalization locks Demand & Supply editing permanently for that plan cycle.
- After Sales Office allocation is marked complete, office allocations are locked.

### Approval Rules

- B2B approval **automatically routes** the plan to MD review; no separate submission step is required.
- Change requests must include comments so the Demand & Supply Team understands what to correct.
- Only the Managing Director may grant final approval before finalization.

### Reconciliation Rules

- Reconciliation is **system-driven**—the platform calculates totals and determines pass or fail.
- Users do **not** manually perform reconciliation or override validation results.
- The reconciliation rule is: **Total Model Targets (Retail) = Total Sales Office Targets = Total Executive Allocations**.

### Notifications

The system generates notifications for:

- Plans submitted for approval
- B2B and MD approvals
- Change requests from B2B or MD
- Plans ready for Sales Office allocation (after finalization)
- Retail allocation complete (enabling Executive allocation)
- Reconciliation failures

---

## 5. User Stories

### Demand & Supply Team

| # | User Story |
|---|------------|
| 1 | As a Demand & Supply planner, I want to create a Monthly Target Plan for a specific month, so that all targets and allocations are organized in one planning cycle. |
| 2 | As a Demand & Supply planner, I want to allocate targets to models and articles, so that approved monthly targets can be distributed accurately to the vehicle level. |
| 3 | As a Demand & Supply planner, I want to finalize the plan after MD approval, so that retail distribution can begin with a locked, approved baseline. |

### B2B Director

| # | User Story |
|---|------------|
| 1 | As a B2B Director, I want to review submitted monthly target plans in a dedicated queue, so that I can assess targets before they reach the Managing Director. |
| 2 | As a B2B Director, I want to approve a plan with one action, so that it is automatically forwarded to MD review without delay. |
| 3 | As a B2B Director, I want to request changes with comments, so that the Demand & Supply Team can correct issues before resubmission. |

### Managing Director

| # | User Story |
|---|------------|
| 1 | As a Managing Director, I want to see plans that have passed B2B review, so that I only approve plans that have already been vetted. |
| 2 | As a Managing Director, I want to approve or request changes on a monthly plan, so that national targets reflect executive sign-off before release. |
| 3 | As a Managing Director, I want visibility into plan status, so that I know which monthly cycles are pending my decision. |

### National Performance Manager / Retail Head

| # | User Story |
|---|------------|
| 1 | As a National Performance Manager, I want to allocate Retail targets across sales offices, so that national retail demand is distributed to the field. |
| 2 | As a National Performance Manager, I want to see how many units remain unallocated, so that I know when Sales Office allocation is complete. |
| 3 | As a National Performance Manager, I want to mark retail allocation complete only when fully allocated, so that downstream executive planning starts from a validated baseline. |

### Branch Manager

| # | User Story |
|---|------------|
| 1 | As a Branch Manager, I want to allocate sales office targets to my sales executives, so that each person has a clear monthly target. |
| 2 | As a Branch Manager, I want to be notified when retail allocation is complete, so that I know when executive allocation can begin. |
| 3 | As a Branch Manager, I want to receive a notification when reconciliation fails, so that I can correct executive allocations before the plan is closed. |

---

## 6. Success Criteria

The MVP will be considered successful when the following outcomes are demonstrated:

| Criterion | Measure of Success |
|-----------|-------------------|
| **End-to-end digital cycle** | A complete monthly planning cycle—from plan creation through completion—can be executed entirely within AutoPlan Targets without offline workarounds. |
| **Approval workflow** | B2B and MD approval, change requests, automatic routing, and finalization function correctly with appropriate locking at each stage. |
| **Retail office allocation** | Retail targets can be fully allocated to sales offices with progress visibility and completion controls. |
| **Executive allocation** | Sales office targets can be allocated to sales executives only after retail allocation is complete. |
| **Automatic reconciliation** | The system validates that Retail model targets, sales office targets, and executive allocations match, without manual reconciliation by users. |
| **Audit trail** | Key actions—including submissions, approvals, change requests, allocations, and completion—are recorded with user, role, and timestamp for management review. |

---

## Approval

| Name | Role | Signature | Date |
|------|------|-----------|------|
| | Business Sponsor | | |
| | Product Owner | | |
| | Managing Director | | |

---

*This document describes business requirements for the AutoPlan Targets MVP. Technical design, system architecture, and implementation details are documented separately.*
