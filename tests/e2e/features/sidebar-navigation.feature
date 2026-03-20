Feature: Sidebar navigation

  Scenario: Navigate to courses page from sidebar
    Given I am on the org dashboard
    When I click "Courses" in the sidebar
    Then I should be on the courses page

  Scenario: Navigate to community page from sidebar
    Given I am on the org dashboard
    When I click "Community" in the sidebar
    Then I should be on the community page
