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

This currently uses jQuery, and the traditional HTML-CSS-JavaScript trio. Because JavaScript has no native wait-until block, it uses a pair of event listeners and is almost entirely function-based. The first event listener sets up the question, which then makes it possible for the user to submit and trigger the second, which then sets up the NEXT QUESTION button that then triggers the first event listener, and so on until the user has finished. The autosave feature works by using the localStorage browser API. The confusion alert feature works by looping through the questions for that topic and using .split() to find the area within the quotation marks.