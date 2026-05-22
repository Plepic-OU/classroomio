# BDD Flows — Coverage Checklist

Machine-readable ground truth for `/bdd audit`. One checkbox per scenario.
Tick a box when the scenario passes twice in a row locally.

---

## Phase 1 — Smoke (≈8)

- [ ] login-success
- [ ] login-failure
- [ ] signup-to-org
- [ ] logout
- [ ] create-course
- [ ] edit-course-title
- [ ] learner-lands-mylearning
- [ ] view-empty-mylearning

## Phase 2 — Author + learner core (≈12)

- [ ] add-lesson
- [ ] reorder-lessons
- [ ] add-quiz-question
- [ ] publish-course
- [ ] duplicate-course
- [ ] delete-course
- [ ] public-landing-renders
- [ ] free-enroll
- [ ] invite-link-enroll
- [ ] open-lesson
- [ ] mark-complete
- [ ] take-quiz-pass

## Phase 3 — Admin + assessment (≈10)

- [ ] invite-member
- [ ] change-role
- [ ] remove-member
- [ ] update-org-name
- [ ] submit-text-answer
- [ ] admin-view-submission
- [ ] grade-submission
- [ ] learner-sees-grade
- [ ] quiz-retry
- [ ] earn-certificate

## Phase 4 — Deferred (TBD)

Scope not yet defined. Topics: Community Q&A, CSV import, landing-page customise.
Add named checkboxes here when Phase 4 is planned.
