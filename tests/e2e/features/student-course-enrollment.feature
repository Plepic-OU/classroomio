Feature: Student Course Enrollment

  Scenario: New student signs up and joins a course via invite link
    Given I navigate to the invite link for course "Modern Web Development with React"
    Then I should be on the login page with a redirect param
    When I click the "Sign up" link
    Then I should be on the signup page
    When I fill in the signup form with email "newstudent@test.com" and password "Test1234!"
    And I submit the signup form
    Then I should be redirected back to the invite page
    When I click the "Join Course" button
    Then I should be redirected to the LMS
