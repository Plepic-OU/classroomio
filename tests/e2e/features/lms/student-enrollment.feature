Feature: Student Enrollment

  @smoke @student @skip
  Scenario: Student can find and enroll in a published course
    Given a published course exists for enrollment
    And I am on the LMS explore page
    When I click learn more on the available course
    And I click the enroll now button
    And I confirm joining the course
    Then I should be enrolled in the course
