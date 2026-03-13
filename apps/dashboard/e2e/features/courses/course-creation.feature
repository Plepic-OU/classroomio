Feature: Course Creation

  Scenario: Create a new course with a title
    Given I am on the courses page
    When I click the create course button
    And I select the course type "Self Paced"
    And I fill in the course title "Introduction to Testing"
    And I submit the course form
    Then I should see the new course "Introduction to Testing" in the courses list
