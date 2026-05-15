Feature: Lesson Management

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD Lesson Course"

  @write
  Scenario: Teacher can create a lesson inside a course
    Given I navigate to the "lessons" tab of this course
    When I click the add lesson button
    And I enter the lesson title "Intro to BDD"
    And I save the new lesson
    Then I should see "Intro to BDD" on the page

  @write
  Scenario: Lesson creation fails with an empty title
    Given I navigate to the "lessons" tab of this course
    When I click the add lesson button
    And I save the new lesson without a title
    Then I should see a lesson title error
