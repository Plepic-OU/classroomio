Feature: Explore Courses

  Scenario: Student can navigate to explore page
    Given I am logged in as "student@test.com"
    When I click on "Explore"
    Then I should be on the explore page
