Feature: Course People

  @slow @teacher
  Scenario: Open the invite modal from the People page
    Given a course exists
    And I am on the people page for that course
    When I click the add people button
    Then the invitation modal should be visible

  @slow @teacher
  Scenario: Copy the student invite link from the invitation modal
    Given a course exists
    And I am on the people page for that course
    When I click the add people button
    And I click the copy link button
    Then the copy confirmation should appear
