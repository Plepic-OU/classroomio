Feature: Course Enrollment

  Scenario: Student enrolls in a free course
    Given I am logged in as "student@test.com"
    And the student is not enrolled in "Getting started with MVC"
    When I click on "Explore"
    And I click on the course "Getting started with MVC"
    And I click the enroll button
    And I click the join course button
    Then I should be redirected to the LMS dashboard
