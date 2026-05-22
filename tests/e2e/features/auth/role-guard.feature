@p0 @role-guard @noauth
Feature: Role guard

  Scenario: Student cannot create a course in admin's org
    Given I am logged in as a student "student@test.com"
    When I navigate to the org courses page "udemy-test"
    Then the create course button should be disabled
