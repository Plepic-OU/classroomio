Feature: Organization Dashboard

  Scenario: Admin sees dashboard with analytics cards
    Given I am logged in as "admin@test.com"
    Then I should see a greeting with the admin name
    And I should see the revenue card
    And I should see the courses count card
    And I should see the students count card
