Feature: Course Creation

  Scenario: Create a new course with a title
    Given no course exists with title "BDD Test Course"
    And I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Test Course"
    And I enter the course description "A test course created by BDD"
    And I submit the new course form
    Then I should see "BDD Test Course" in the course list
