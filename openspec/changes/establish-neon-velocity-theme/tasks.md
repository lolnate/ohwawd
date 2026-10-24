# Tasks

Beans is the live execution tracker. These are pending implementation tasks, not a record of completed production styling.

Parent epic: **ohwawd-t1qd — Adopt Neon Velocity visual theme**.

## 1. Semantic foundation — ohwawd-0t83

- [ ] 1.1 Introduce shared semantic color/type/radius/motion tokens and local typography/fallbacks, with initial base-style migration; verify representative contrast pairs, native-control readability, offline font behavior, TypeScript/build compatibility and documented aliases.

## 2. Shared shell and interactions — ohwawd-somy

- [ ] 2.1 Migrate authentication, workspace navigation, panels, controls and overlays at source; verify actual rendered normal/hover/focus/disabled/pending/error states, keyboard and dismissal/focus behavior, responsive geometry, and update relevant reference notes.

## 3. Board and calendar semantics — ohwawd-px1w

- [ ] 3.1 Migrate Board and calendar graphics while preserving independent ownership/provenance/availability cues and data geometry; verify combined states, real scheduling values, scrolling, focus and forced-color behavior through focused browser tests and document marker refinements.

## 4. Remaining workspace views — ohwawd-lw34

- [ ] 4.1 Migrate Outcomes/catalog/delivery, Linear source/project lists, scenarios/comparisons and current configuration surfaces, integrating separately planned catalog/Settings components if present; verify each view's semantic states and mobile readability, audit leftover palette literals and update delivered-theme documentation.

## 5. Cross-product acceptance — ohwawd-wsxo

- [ ] 5.1 Run configured TypeScript/build/unit and affected UI suites, inspect 1440px/768px/390px and enlarged-text layouts, verify contrast/focus/reduced-motion/forced-color/offline behavior, confirm unchanged planning and persistence, record evidence and reconcile reference/preview/status after all implementation units pass.

## Dependencies

`ohwawd-0t83` → `ohwawd-somy` → `ohwawd-px1w` → `ohwawd-lw34` → `ohwawd-wsxo`.

The Catalog and Settings functional plans have no prerequisite relationship with the core theme. Coordinate their visual integration against the latest implementation; do not implement their functionality inside theme work.

## Workflow follow-up

- Keep the production implementation status pending until the complete migration and cross-product verification pass.
- Complete the parent epic, reconcile this checklist, validate the overall change and archive using the normal OpenSpec workflow.
- Update Bean references to archived artifacts when the change is moved.
