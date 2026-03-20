Feature: Course creation

  Scenario: Create a new course
    Given I am logged in as "admin@test.com" with password "123456"
    And I am on the courses page
    When I click the create course button
    And I select the "Self Paced" course type
    And I click the next button
    And I enter the course name "BDD Test Course"
    And I enter the course description "A test course created by BDD"
    And I click the finish button
    Then I should see "BDD Test Course" in the course list
