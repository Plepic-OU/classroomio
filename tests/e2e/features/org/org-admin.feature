Feature: Organisation Admin

  Scenario: Admin can see the team invite form in org settings
    Given I am logged in as "admin@test.com"
    When I navigate to the org settings team tab
    Then I should see the invite email field
    And I should see the send invite button
