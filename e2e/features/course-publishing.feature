Feature: Course Publishing

  Background:
    Given I am logged in as an admin

  Scenario: Admin publishes a newly created course
    When I navigate to the courses page
    And I click the create course button
    And I select the course type "Self Paced"
    And I click the next button to proceed
    And I fill in the course title "Publish Test Course"
    And I fill in the course description "A course to test the publish flow"
    And I submit the course form
    And I navigate to the course settings
    And I toggle the publish switch
    And I save the course settings
    Then the course should be marked as published
