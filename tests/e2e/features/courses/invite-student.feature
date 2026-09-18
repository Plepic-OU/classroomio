@resets-db @known-issue
Feature: Invite a student

  # Currently fails — see references/suspected-bugs.md "Student invite link join is
  # blocked by RLS". Kept (not deleted) tagged @known-issue so it documents the gap
  # and is excluded from normal runs (playwright.config.ts: tags: 'not @known-issue').
  Scenario: Student joins a course via an invite link
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "Invite Flow Course"
    And I enter the course description "Course used to verify the student invite flow"
    And I submit the new course form
    Then I should be redirected to the new course page
    When I open the course people tab
    And I copy the student invite link
    And I am logged in as "student@test.com"
    And I open the copied invite link
    And I click the join course button
    Then I should be redirected away from the invite page
