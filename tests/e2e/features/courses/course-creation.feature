@p0 @needs-reset
Feature: Course Creation

  Scenario Outline: Create a new course with type <course type>
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select course type "<course type>" and proceed
    And I enter the course title "BDD Test Course"
    And I enter the course description "A short description for the BDD test course"
    And I submit the new course form
    Then I should be redirected to the new course page

    Examples:
      | course type |
      | Live Class  |
      | Self Paced  |

  Scenario: Show validation error when creating course without a title
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select course type "Live Class" and proceed
    And I submit the new course form
    Then I should see a title validation error
