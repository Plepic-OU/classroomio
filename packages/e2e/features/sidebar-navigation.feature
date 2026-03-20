Feature: Sidebar Navigation

  Scenario: Navigate to courses page via sidebar
    Given I am logged in
    And I am on the org dashboard page
    When I click the "Courses" sidebar link
    Then I should be on the org courses page

  Scenario: Navigate to community page via sidebar
    Given I am logged in
    And I am on the org dashboard page
    When I click the "Community" sidebar link
    Then I should be on the org community page
