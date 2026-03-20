Feature: Organization Dashboard

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Dashboard displays greeting and key sections
    Then I should see a greeting with "Elon Gates"
    And I should see the "Top Courses" section
    And I should see the "Recent Enrollments" section

  Scenario: Navigate to courses page from dashboard
    When I click the courses navigation link
    Then I should be on the courses page
    And I should see the "Courses" heading
