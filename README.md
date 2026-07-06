# spanish-quizzer
This is a Spanish Quizzer to quiz you on your skills. This is strictly for the Senderos Spanish curriculum.

## Key features
You select a course, chapter, and topic from the Senderos Curriculum. It quizzes you multiple times until you consistently get it right. There is a streak counter as well as "I got it right/wrong" buttons in case the system made a mistake. There is also an autosave feature so even if you reload or close the tab your progress is saved. If you want to restart from the beginning, you have to press "reset". It also alerts you if you got the answer confused with another question

## Keyboard shortcuts
There are multiple keyboard shorcuts installed to make it easy to operate the site.
* Alt + vowel(A, E, I, O, U): Types an accented version of the vowel. Works with shift for caps.
* Alt + N: Types an ñ. Works with shift for caps.
* Alt + Y: Types a ü. Works with shift for caps.
* Alt + !(technically Alt + Shift + 1): Types an upside down exclamation mark.
* Alt + ?(technically Alt + Shift + /): Types an upside down question mark.
* Alt + Q: Moves on to the next question, or grades your answer, depending on what current state the page is in.
* Alt + M: Works like the "I got this correct/wrong" button.

## How it works

This currently uses jQuery, and the traditional HTML-CSS-JavaScript trio. Because JavaScript has no native wait-until block, it uses a pair of event listeners and is almost entirely function-based. The first event listener sets up the question, which then makes it possible for the user to submit and trigger the second, which then sets up the NEXT QUESTION button that then triggers the first event listener, and so on until the user has finished. The autosave feature works by using the localStorage browser API. The confusion alert feature works by looping through the questions for that topic and using .split() to find the area within the quotation marks.'

## Details(For those of you who want to know the exact steps)

### General cycle:

1. All functions are defined. All variables and functions predefined, event listeners attached, stuff get ready in setUp() function.
2. The code adds an event listener for when the submit event happens, which then calls the checkAnswer() function.
3. The check function then checks and shows the results. It works by doing the following things:
    * It uses processAnswer() to be a bit forgiving with spaces and punctuation, and does it to both so that it can compare them against each other.
        * If the user was correct, then not much happens.
        * If they were wrong:
            * It first checks if the user got confused with another question by looping through the other questions.
            * The function checkForConfusion uses recursion to increasingly narrow it down if there are multiple results.
            * The result banner says what question the user got confused with.
            * Otherwise, a random "Try again next time" encouragement is pulled from either wrongFeedback or streakLossFeedback(If they lost a big streak)
            * findQuestionSpots() then finds the locations to insert the wrong question in two more spots(but preventing consecutives if they got it wrong a bunch of times), which makes sure that if they only get one question wrong the whole time, then only that question will be left at the end, and that they don't have to wait for the whole questionArray to repeat to try again.
        * Finally, the basic page setup is done.
4. When the "next" button is pressed then the setUpQuestion() function sets up the next question, and the cycle repeats.
5. setUpQuestion() always checks if the user has finished the questions and if it has then the script terminates by showing party sign, accuracy, and it deletes the form so that the submit event never happens again.
The current question and the array of questions are defined as data-* attributes in the quizbox div, and they are accessed and modified using getCurrentQuestion(), changeCurrentQuestion(), getQuestionArray(), & changeQuestionArray().

### Topic selection:

1. askUserForCourse() asks you for your course(1a, 1b, etc.) by iterating through the data object and looking at all the courses. An event listener is added for when you click submit using jQuery .one().
2. After you click it, the old event listener is deleted automatically by jQuery, the fieldset that surrounds all the options that were injected dynamically is disabled and so is the button so you can't change your answer(and mess up the code), and askUserForChapter() now asks you for your chapter. An event listener is there for that.
3. Same thing happens for askUserForTopic()
4. Once that happens, it figures out the questionArray and the content loads.

### Manual grading:

1. When this button is clicked, manualGrading() is called.
2. It reverses the effect that checkAnswer() did, which depends on the scenario.
    * If we have to mark it wrong, it injects questions using findQuestionSpots(), the same thing that checkAnswer() does, and reverses everything in the variables checkAnswer() did.    
    * If we have to mark it correct, it removes the stuff that findQuestionSpots() injected in the middle by looking at insertLocations. It also reverses the streak(using oldStreak from the previous question) and other variables.
3. It calls setUpQuestion like the generic next question button.

### Autosave feature(using the localStorage browser API):

1. If the user was still selecting their course/chapter/topic, run normally.
2. Otherwise, delete the forms, and setup the page(without using setUp(), but code copy pasted from it because running that requires an event listener event object).
3. Depending on their state-
    * Question: Proceed as normal. Set the normal stuff(again, using code copy pasted from setUpQuestion because triggering it directly requires an event object with the .preventDefault() method).
    * Answer: Make the question disappear and trigger checkAnswer(). Run a smaller version of checkAnswer to figure out whether the user got it correct or wrong. However, no variable modification is needed because the variables were saved AFTER they were modified.