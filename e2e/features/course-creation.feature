Feature: Course creation

  @course
  Scenario: Create a new course with a title
    Given I am logged in as "admin@test.com"
    When I navigate to the courses page
    And I click the create course button
    And I select the "Self Paced" course type
    And I click next
    And I enter course title "BDD Test Course"
    And I enter course description "A BDD end-to-end test course"
    And I submit the course creation form
    Then I should be on the new course page
    When I navigate to the courses page
    Then I should see "BDD Test Course" in the courses list
