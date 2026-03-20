Feature: Course Detail

  Scenario: View course detail page from course list
    Given I am logged in
    And I am on the org courses page
    When I click on the first course in the list
    Then I should see the course navigation sidebar
    And I should see the "News Feed" heading
