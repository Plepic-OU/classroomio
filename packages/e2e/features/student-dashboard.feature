Feature: Student Dashboard

  Scenario: Student dashboard displays greeting and progress
    Given I am logged in
    And I am on the student dashboard
    Then I should see a personalized greeting
    And I should see the progress section
    And I should see the student sidebar navigation
