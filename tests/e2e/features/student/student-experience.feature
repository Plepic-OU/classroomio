Feature: Student Experience

  Scenario: Authenticated user can access the LMS page
    Given I am logged in as "admin@test.com"
    When I navigate to the LMS page
    Then I should be on the LMS page

  Scenario: LMS page shows My Learning section
    Given I am logged in as "admin@test.com"
    When I navigate to the LMS page
    Then I should see the my learning section
