Feature: Course Enrollment

  Scenario: Teacher views the organisation courses page
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    Then I should see "BDD Test Course" in the course list

  Scenario: Student views available courses on the explore page
    Given I am logged in as student "student@test.com"
    When I navigate to the explore page
    Then I should see the explore courses heading
