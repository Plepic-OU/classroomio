Feature: Course Creation

  Background:
    Given I am logged in as an admin

  Scenario: Admin creates a course successfully
    When I navigate to the courses page
    And I click the create course button
    And I select the course type "Self Paced"
    And I click the next button to proceed
    And I fill in the course title "Introduction to Testing"
    And I fill in the course description "A short description for testing purposes"
    And I submit the course form
    Then I should see the new course in the courses list
