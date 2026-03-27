Feature: Waitinglist

  Scenario: Visitor submits email to waitinglist
    Given I am on the landing page
    When I fill in the waitinglist email "test-waitinglist@example.com"
    And I submit the waitinglist form
    Then I should see a waitinglist success message

  Scenario: Admin views waitinglist entries
    Given I am logged in as an admin
    And I am on the org waitinglist page
    Then I should see the waitinglist table
