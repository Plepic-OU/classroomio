Feature: Course Listing

  Scenario: Admin can view courses on the courses page
    Given I am logged in as "admin@test.com"
    When I navigate to the courses page
    Then I should see the courses heading
    And I should see the "Create Course" button
