Feature: My Learning

  @auth-student
  Scenario: learner-lands-mylearning
    Given I navigate to my learning page
    Then I should see the My Learning heading

  @auth-student
  Scenario: view-empty-mylearning
    Given I navigate to my learning page
    Then I should see no courses in progress
