Feature: Community

  Scenario: Post a question to the community
    Given I am on the community page
    When I click the ask community button
    And I enter the question title "How do I reset my progress?"
    And I select a course for the question
    And I enter the question body "I need help understanding how to reset my course progress. Can someone explain the steps?"
    And I click the publish button
    Then I should see "How do I reset my progress?" on the question page
