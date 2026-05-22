@p0 @needs-reset
Feature: Publish and Landing Page

  Scenario: Publish a course and verify anonymous viewer sees the landing page
    Given I have created a course named "BDD Landing Course"
    And I am on the course settings page
    When I toggle the course to published
    And I save the course settings
    Then the course link should be displayed
    When an anonymous visitor opens the course link
    Then they should see the course landing page
