Feature: Student views enrolled course in My Learning

  Scenario: Student sees enrolled courses on the My Learning page
    Given I am logged in and navigate to My Learning
    Then I should see at least one course on the My Learning page
