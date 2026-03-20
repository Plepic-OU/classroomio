Feature: Student Enrollment

  Scenario: Student signs up to a free course
    Given I am on the join page for a free enrollable course
    When I confirm joining the course
    Then I should be taken to the student dashboard
