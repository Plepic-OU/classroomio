Feature: Student LMS Dashboard

  Scenario: Student sees LMS dashboard after login
    Given I am logged in as "student@test.com"
    Then I should be on the LMS dashboard
    And I should see a greeting with my name

  Scenario: Student navigates to My Learning
    Given I am logged in as "student@test.com"
    When I click on "My Learning"
    Then I should be on the My Learning page
