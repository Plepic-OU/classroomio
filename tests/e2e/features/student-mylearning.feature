Feature: Student My Learning

  Scenario: Student sees their enrolled course in My Learning
    Given I am logged in as a student
    When I navigate to My Learning
    Then I should see "Data Science with Python and Pandas" in my courses
