Feature: Waitlist Settings

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Teacher sets max capacity on a course
    When I navigate to settings for course "Getting started with MVC"
    And I set max capacity to "20"
    And I save the course settings
    Then the settings should save successfully
