@wave1 @auth
Feature: Session persistence

  @persona-admin
  Scenario: A page reload keeps the admin logged in
    Given I am logged in via the admin storage state
    When I land on the admin org dashboard
    And I reload the page
    Then I am still on the admin org dashboard
    And I am not redirected to the login page
