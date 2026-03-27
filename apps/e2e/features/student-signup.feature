Feature: Student Signup

  Scenario: New student signs up and completes onboarding
    Given I am on the signup page
    When I fill in signup email "newstudent@test.com"
    And I fill in signup password "Test1234!"
    And I confirm the password "Test1234!"
    And I click the create account button
    Then I should be redirected to onboarding
    When I fill in my full name "New Student"
    And I fill in organization name "Test Academy"
    And I click the next button
    And I select a goal
    And I select a source
    And I click the finish button
    Then I should be redirected to my org dashboard
