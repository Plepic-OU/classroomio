Feature: Exercise Submission

  Scenario: Student views their exercises on the LMS exercises page
    Given I am logged in as student "student@test.com"
    When I navigate to the exercises page
    Then I should see the exercises heading
    And I should see the "Not Submitted" section

  Scenario: Teacher views student submissions for a course
    Given I am logged in as "admin@test.com"
    When I navigate to the submissions page for the test course
    Then I should see the submitted exercises heading
