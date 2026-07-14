/*
Welcome to the brain of the spanish quizzer! Note that the "data" object is a global variable and so are correctFeedback, wrongFeedback and streakLossFeedback because they are in data.js which is loaded in the html before this script is. jQuery is loaded in here too.
*/
//Used to access the answers from the data object.
let courseSelected = ""
let chapterSelected = ""
let topicSelected = ""
//This is mainly so that storeInLocalStorage can access these.
let userAnswer = ""
let answers = [];
//An object that stores the amount of reps the user still has to do for each question.
let questionRep = {};
//This stores the streak and is updated by refreshStreak()
let streak = 0;
//This stores the previous state of the streak from the question before and is primarily for manualGrading to revert to the old streak.
let oldStreak = 0;
//These two are for recording accuracy.
let questionsCorrect = 0;
let totalQuestions = 0;
// This is a global also for storeInLocalStorage so that manualGrading can access it. insertLocations stores all locations besides the end of the array to insert the question that was wrong, and is produced by findQuestionSpots, which makes sure there's no consecutives.
let insertLocations = [];
// This is actually an outdated global variable that I should remove, and it is for keyboardShortcuts.
let operatingSystem = "";
if (navigator.platform.includes("MacIntel")) {
    operatingSystem = "macOS"
}
const getQuestionArray = function () {
    const questions = $("#quiz-box").attr("data-question-array");
    if (questions.length === 0) {
        return []
    }
    return JSON.parse(questions)
}
const changeQuestionArray = function (array) {
    $("#quiz-box").attr("data-question-array", JSON.stringify(array));
}
const getCurrentQuestion = function () {
    return $("#quiz-box").attr("data-current-question")
}
const changeCurrentQuestion = function (newQuestion) {
    return $("#quiz-box").attr("data-current-question", newQuestion)
}
const refreshStreak = function (newStreak) {
    $("#streak-num").text(newStreak);
    if (newStreak >= 5) {
        $("#flaming-icon").css("display", "inline");
        $("#streak-num").css("color", "red");
        if (newStreak >= 10) {
            //There are double digits, so make the flaming icon a bit bigger.
            $("#flaming-icon").attr("width", "100px")
            $("#flaming-icon").css("left", "125px")
            $("#flaming-icon").css("top", "5px")
        } else {
            $("#flaming-icon").attr("width", "70px")
            $("#flaming-icon").css("left", "135px")
            $("#flaming-icon").css("top", "20px")
        }
    } else {
        $("#flaming-icon").css("display", "none");
        $("#streak-num").css("color", "black");
    }
    streak = newStreak
}
const shuffleArray = function (array){
    let shuffled = array
    let j;
    for (let i = shuffled.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    };
    return shuffled;
};
const getSystemInfo = function () {
    let info = {};
    const ua = navigator.userAgent
    let device = "Desktop"
    if (/tablet|ipad|silk|playbook/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) { //Either it's a tablet or a modern iPad.
        device = "Tablet"
    } else if (/ip(hone|od)|android|blackberry|IEmobile/i.test(ua)) {
        device = "Phone"
    }
    info["device"] = device
    let os = "Unknown";
    if (/Windows NT/i.test(ua)) {
        os = "Windows"
    } else if (/Macintosh/i.test(ua)) {
        if (navigator.maxTouchPoints > 1) {
            os = "iPadOS"
        } else {
            os = "MacOS"
        }
    } else if (/Android/i.test(ua)) {
        os = "Android"
    } else if (/iPhone|iPod/i.test(ua)) {
        os = "iOS"
    } else if (/iPad/i.test(ua)) {
        os = "iPadOS"
    }
    info["os"] = os
    let browser = "Chrome" //By default on average it is chrome
    if (/edg\//i.test(ua)) { //Escapes the /.
        browser = "Edge"
    } else if (/OPR|Opera/i.test(ua)) {
        browser = "Opera"
    } else if (/Chrome/i.test(ua)) {
        browser = "Chrome"
    } else if (/Firefox/i.test(ua)) {
        browser = "Firefox"
    } else if (/Safari/i.test(ua)) {
        browser = "Safari"
    }
    info["browser"] = browser
    return info;
}
const processAnswer = function (answer, removePunctuation=true, removeSpaces=true) {
    answer = answer.toLowerCase()
    if (removeSpaces) {
        answer = answer.replaceAll(" ", "") //Removes all spaces.
    }
    //Remove all other weird symbols.
    answer = answer.replaceAll("[", "")
    answer = answer.replaceAll("]", "")
    answer = answer.replaceAll(":", "")
    answer = answer.replaceAll(";", "")
    answer = answer.replaceAll("{", "")
    answer = answer.replaceAll("}", "")
    answer = answer.replaceAll("\\", "")
    answer = answer.replaceAll("/", "")
    answer = answer.replaceAll(")", "")
    answer = answer.replaceAll("(", "")
    answer = answer.replaceAll("|", "")
    answer = answer.replaceAll("$", "")
    if (removePunctuation) {
        answer = answer.replaceAll("?", "")
        answer = answer.replaceAll("!", "")
        answer = answer.replaceAll("¿", "")
        answer = answer.replaceAll("¡", "")
        answer = answer.replaceAll(",", "")
        answer = answer.replaceAll(".", "")
    }
    return answer
}
const insertChar = function (char, deletePrevious=false) {
    const domEl = $('[name="answer"]')[0]
    if ($(domEl).css("display") === "none") {
        return 0; //If the domEl is hidden why add something to it?
    }
    const startPos = domEl.selectionStart
    const endPos = domEl.selectionEnd
    const currentVal = $(domEl).val()
    const newVal = currentVal.slice(0, deletePrevious ? startPos - 1 : startPos) + char + currentVal.slice(endPos)
    $(domEl).val(newVal)
    if (deletePrevious) {
        domEl.setSelectionRange(startPos, startPos)
    } else {
        domEl.setSelectionRange(startPos + 1, startPos + 1)
    }
    $(domEl).focus()
}
const keyboardShortcut = function (event) {
    //This is the function that makes sure that you can press enter and the next question will trigger.
    //Ban all shortcuts on mobile. MWAHAHAHAHA!
    if (getSystemInfo().device !== "Desktop") {
        return;
    }
    if (operatingSystem === "macOS") {
        //Entirely different setup for macOS. 
        const keyPressed = event.code
        const keys = ["KeyA", "KeyE", "KeyI", "KeyO", "KeyU", "KeyN", "KeyY", "KeyQ", "KeyM"]
        if ((keys.includes(keyPressed) || (keyPressed === "Digit1" && event.shiftKey) || (keyPressed === "Slash")) && event.altKey){
            event.preventDefault()
            const shifted = Boolean(event.originalEvent.getModifierState("CapsLock") ^ event.shiftKey) // ^ is bitwise exclusive or operator. Since it returns 0 or 1, you have to use Boolean() on it.
            switch (keyPressed) {
                case "KeyA":
                    if (shifted) {
                        insertChar("Á")
                    } else {
                        insertChar("á")
                    }
                    break;
                case "KeyE":
                    if (shifted) {
                        insertChar("É")
                    } else {
                        insertChar("é", true)
                    }
                    break;
                case "KeyI":
                    if (shifted) {
                        insertChar("Í")
                    } else {
                        insertChar("í", true)
                    }
                    break;
                case "KeyO":
                    if (shifted) {
                        insertChar("Ó")
                    } else {
                        insertChar("ó")
                    }
                    break;
                case "KeyU":
                    if (shifted) {
                        insertChar("Ú")
                    } else {
                        insertChar("ú", true)
                    }
                    break;
                case "KeyY":
                    if (shifted) {
                        insertChar("Ü")
                    } else {
                        insertChar("ü")
                    }
                    break;
                case "KeyN":
                    if (shifted) {
                        insertChar("Ñ")
                    } else {
                        insertChar("ñ", true)
                    }
                    break;
                case "Slash":
                    insertChar("¿")
                    break;
                case "Digit1":
                    if (event.shiftKey) {
                        insertChar("¡")
                    } //Otherwise macos automatically inserts an upside down exclamation mark.
                    break;
                case "KeyQ":
                    if ($("#form").css("display") === "none") {
                        //Scenario where the input box isn't there.
                        $("#next-question").trigger("click")
                    } else {
                        //Check the answer, but prevent spamming.
                        if ($('[name="answer"]').val()) {
                            //Uses truthy/falsy because if it is an empty string then don't spam.
                            $("#form").trigger("submit")
                        }
                    }
                    break;
                case "KeyM":
                    if ($("#form").css("display") === "none") {
                        //It should be grading time.
                        if ($("#result").css("color") === "rgb(255, 0, 0)") {
                            //If it is wrong then mark it correct.
                            $("#manual-grading").trigger("click", {ogResult: false})
                        } else {
                            $("#manual-grading").trigger("click", {ogResult: true})
                        }
                    }
        }
        }
    } else {
        const keyPressed = event.key
        const keys = ["a", "e", "i", "o", "u", "n", "y", "A", "E", "I", "O", "U", "N", "Y", "!", "1", "?", "/", "q", "m"];
        if (keys.includes(keyPressed) && event.altKey) {
            event.preventDefault();
        }
        if (event.altKey) {
            switch (keyPressed) {
                case "a": insertChar("á"); break;
                case "e": insertChar("é"); break;
                case "i": insertChar("í"); break;
                case "o": insertChar("ó"); break;
                case "u": insertChar("ú"); break;
                case "y": insertChar("ü"); break;
                case "n": insertChar("ñ"); break;
                case "A": insertChar("Á"); break;
                case "E": insertChar("É"); break;
                case "I": insertChar("Í"); break;
                case "O": insertChar("Ó"); break;
                case "U": insertChar("Ú"); break;
                case "Y": insertChar("Ü"); break;
                case "N": insertChar("Ñ"); break;
                case "?": case "/": insertChar("¿"); break;
                case "!": case "1": insertChar("¡"); break;
                case "q":
                case "Q":
                    if ($("#form").css("display") === "none") {
                        //Scenario where the input box isn't there.
                        $("#next-question").trigger("click");
                    } else {
                        //Check the answer, but prevent spamming.
                        if ($('[name="answer"]').val()) {
                            //Uses truthy/falsy because if it is an empty string then don't spam.
                            $("#form").trigger("submit")
                        }
                    }
                    break;
                case "m":
                case "M":
                    if ($("#form").css("display") === "none") {
                        //It should be grading time.
                        if ($("#result").css("color") === "rgb(255, 0, 0)") {
                            //If it is wrong then mark it correct.
                            $("#manual-grading").trigger("click", {ogResult: false})
                        } else {
                            $("#manual-grading").trigger("click", {ogResult: true})
                        }
                    }
            }
        }
    }
}
const storeInLocalStorage = function () {
    if ($("#content").css("display") === "none") {
        localStorage.setItem("state", "selection")
    } else if ($("#form").css("display") === "none") {
        localStorage.setItem("state", "answer")
    } else {
        localStorage.setItem("state", "question")
    }
    localStorage.setItem("courseSelected", courseSelected)
    localStorage.setItem("chapterSelected", chapterSelected)
    localStorage.setItem("topicSelected", topicSelected)
    localStorage.setItem("answers", JSON.stringify(answers))
    localStorage.setItem("userAnswer", userAnswer)
    localStorage.setItem("questionRep", JSON.stringify(questionRep))
    localStorage.setItem("streak", JSON.stringify(streak))
    localStorage.setItem("oldStreak", JSON.stringify(oldStreak))
    localStorage.setItem("currentQuestion", getCurrentQuestion())
    localStorage.setItem("questionArray", JSON.stringify(getQuestionArray()))
    localStorage.setItem("totalQuestions", String(totalQuestions))
    localStorage.setItem("questionsCorrect", String(questionsCorrect))
    localStorage.setItem("insertLocations", JSON.stringify(insertLocations))
    localStorage.setItem("$resultText", $("#result").text())
    //This stores EVERYTHING in localstorage, useful or not.
}
const getLocalStorage = function () {
    try {
        return {
            "state":localStorage.getItem("state"),
            "courseSelected":localStorage.getItem("courseSelected"),
            "chapterSelected":localStorage.getItem("chapterSelected"),
            "topicSelected":localStorage.getItem("topicSelected"),
            "answers":JSON.parse(localStorage.getItem("answers")),
            "userAnswer":localStorage.getItem("userAnswer"),
            "questionRep":JSON.parse(localStorage.getItem("questionRep")),
            "streak":JSON.parse(localStorage.getItem("streak")),
            "oldStreak":JSON.parse(localStorage.getItem("oldStreak")),
            "currentQuestion":localStorage.getItem("currentQuestion"),
            "questionArray":JSON.parse(localStorage.getItem("questionArray")),
            "totalQuestions":Number(localStorage.getItem("totalQuestions")),
            "questionsCorrect":Number(localStorage.getItem("questionsCorrect")),
            "insertLocations":JSON.parse(localStorage.getItem("insertLocations")),
            "$resultText":localStorage.getItem("$resultText"),
        }
    } catch {
        return {
            state:"selection"
        }
    }
}
const shiftAll = function () {
    //So that the user can input uppercase and lowercase special symbols.
    if ($("#shift").text() === "shift") {
        //Scenario where we need to uppercase everything.
        $("#shift").text("SHIFT")
        $(".shift").each(function (index, element) {
            $(element).text($(element).text().toUpperCase()) //element is a DOM node
        })
    } else {
        //Scenario where we need to lowercase everything.
        $("#shift").text("shift")
        $(".shift").each(function (index, element) {
            $(element).text($(element).text().toLowerCase()) //element is a DOM node
        })
    }
}
const findQuestionSpots = function (question, array) {
    // This returns either an array of indexes to insert, or undefined.
    // It returns an array of 2
    if (!array.includes(question)) {
        if (array.length >= 6) {
            return [2, 5];
        } else {
            return;
        };
    };
    if (array.length <= 3) {
        return;
    };
    const bufferLength = 2;
    const startingBuffer = 2;
    let candidates = []
    for (let i = startingBuffer; i < array.length; i++) {
        //Note to self keep it this way so that it always returns ordered list.
        const checkArea = array.slice(Math.max(i - bufferLength, 0), Math.min(i + bufferLength + 1, array.length)); // + 1 is required because the second value is exclusive.
        if (checkArea.includes(question)) {
            continue;
        }
        if (candidates.length && candidates[candidates.length - 1] > i - bufferLength) {
            //If this is too close to another candidate, return 0.
            continue;
        }
        candidates.push(i)
    };
    if (candidates.length === 0) {
        return;
    } else if (candidates.length <= 2) {
        return candidates
    }
    // We better find the lowest two if there are more than 2, but make sure they're not touching.
    //Remember they were placed in order?
    return [candidates[0], candidates[1]]
};
const manualGrading = function (event) {
    let questionArray = getQuestionArray()
    let question = getCurrentQuestion()
    if (event.data.ogResult) { //Event.data is boolean
        //If it is true then that means that we need to mark it wrong.
        questionArray.push(question)
        insertLocations = findQuestionSpots(getCurrentQuestion(), questionArray);
        if (insertLocations) {
            //This makes sure that if it can't find a spot, then don't iterate over undefined.
            for (let i = insertLocations.length - 1; i >= 0; i--) { //Makes sure to iterate backwards so no bugs happen
                const insertLocation = insertLocations[i]
                questionArray.splice(insertLocation, 0, getCurrentQuestion())
            }
        }
        questionRep[question] = questionRep[question] + 3 //To account for the one that checkAnswer just subtracted.
        streak = 0
        refreshStreak(streak)
        questionsCorrect--
    } else {
        //We need to mark it correct instead.
        questionRep[question] = questionRep[question] - 3
        //We must remove the extra ones that checkAnswer has inserted.
        if (insertLocations) {
            for (let i = 0; i < insertLocations.length; i++) {
                const location = insertLocations[i]
                questionArray.splice(location, 1)
            }
            }
            if (questionRep[question] <= 0) {
                questionArray.pop() //remove the question from the end
        }
        streak = oldStreak + 1;
        questionsCorrect++
        refreshStreak(streak);
    }
    changeQuestionArray(questionArray);
    $("#next-question").trigger("click");
}
const reset = function () {
    $("*").removeAttr("style");
    $("#quiz-title").text("Quiz Mode")
    $("#course-disable").prop("disabled", false);
    $("#chapter-disable").prop("disabled", false);
    $("#topic-disable").prop("disabled", false);
    $("#course-selection").empty();
    $("#chapter-selection").empty();
    $("#topic-selection").empty();
    refreshStreak(0);
    //Reset all variables.
    streak = 0;
    oldStreak = 0;
    courseSelected = "";
    chapterSelected = "";
    topicSelected = "";
    answers = [];
    userAnswer = "";
    questionRep = {};
    questionsCorrect = 0;
    totalQuestions = 0;
    //Remove all event listeners.
    $("button").each(function (index, element) {
        $(element).off();
    });
    $(document).off("keydown");
    $(document).off("click");
    $("*").off(); ///Just in case destroys any remaining event listeners.
    $("#reset").on("click", resetButton); //Don't destroy the event listener for resetButton!!!
    //Clear localStorage.
    localStorage.clear()
    // Make sure to add the default required element though.
    $("#course-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    $("#chapter-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    $("#topic-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    askUserForCourse();
}
const resetButton = function () {
    if (!getQuestionArray()[0] || $("#content").css("display") === "none") {
        reset()
        return 0;
    }
    const confirmReset = confirm("Are you sure you want to reset? Your progress will be lost.")
    if (confirmReset) {
        reset()
        return 0;
    }
}
const checkAnswer = function (event={}) {
    if (Object.keys(event).length !== 0) {
        event.preventDefault();
    };
    userAnswer = ($('input[name="answer"]').val()).trim().toLowerCase()
    if (userAnswer.length === 0) {
        return; //Makes sure to not count empty accidental answers.
    }
    answers = data[courseSelected][chapterSelected][topicSelected][getCurrentQuestion()];
    let $result = $("#result");
    $("#form").css("display", "none");
    let questionArray = getQuestionArray();
    let processedAnswers = []
    for (let i = 0; i < answers.length; i++) {
        processedAnswers.push(processAnswer(answers[i]))
    }
    if (processedAnswers.includes(processAnswer(userAnswer))) {
        //It's correct!
        $result.text(correctFeedback[Math.floor(Math.random() * correctFeedback.length)]);
        $result.css("color", "green")
        $result.css("display", "block")
        $("#correct-sound")[0].play()
        //Okay, now time to modify the question array b/c the user got it right!
        if (questionRep[getCurrentQuestion()] === 1) {
            questionArray.shift(); //They have completed the required amounts of reps.
            questionRep[getCurrentQuestion()] = questionRep[getCurrentQuestion()] - 1 //While this is useless mostly, it can help with debugging.
        } else {
            questionArray.push(questionArray.shift()) //They have not completed the required reps.
            questionRep[getCurrentQuestion()] = questionRep[getCurrentQuestion()] - 1 //However, deduct one rep from the total.
        }
        streak++
        questionsCorrect++
        totalQuestions++
        refreshStreak(streak)
        if (getQuestionArray().length === 1 && questionRep[getCurrentQuestion()] <= 1) {
            $("#next-question").text("Finish")
        } else {
            $("#next-question").text("Next Question")
        }
        $("#manual-grading").text("I got this wrong");
        $("#manual-grading").css("background-color", "var(--manual-grading-wrong-color)");
        $("#manual-grading").on("click", {ogResult: true}, manualGrading);
    } else {
        // Oops. The user got it wrong.
        //First, let's check if they confused it with a different question.
        const questionAnswerObject = data[courseSelected][chapterSelected][topicSelected]
        let confusedFeedback;
        let confusionIterations = 0;
        // Uses function recursion to narrow down if there are multiple results.
        function checkForConfusion (removePunctuation=true, removeSpaces=true) {
            let matches = [];
            const processedUserAnswer = processAnswer(userAnswer, removePunctuation, removeSpaces)
            for (const questionInArray of Object.keys(questionAnswerObject)) {
                const answersForQuestion = questionAnswerObject[questionInArray]
                //Loops through the different answers for each question.
                for (const answer of answersForQuestion) {
                    if (processAnswer(answer, removePunctuation, removeSpaces) === processedUserAnswer) {
                        if (!matches.includes(questionInArray)) {
                            matches.push(questionInArray);
                        }
                    }
                }
            }
            if (matches.length === 1 || confusionIterations === 4) {
                //Now, let's proceed to find what the question was asking for.
                const matchArray = matches[0].split('"')
                if (matchArray.length === 3 && matchArray[1].trim()) { //Makes sure that matchArray[1] is not empty.
                    confusedFeedback = `Did you confuse it with "${matchArray[1]}"?`
                    return;
                } 
            } else if (matches.length > 1) {
                //Do more detailed filtering...that wasn't enough.
                //First let's do that same loop, but by processing the answer WITHOUT spaces removal.
                confusionIterations++
                if (confusionIterations === 1) {
                    checkForConfusion(true, false)
                } else if (confusionIterations === 2) {
                    checkForConfusion(false, true)
                } else if (confusionIterations === 3) {
                    checkForConfusion(false, false)
                }
            }
        }
        checkForConfusion()
        if (confusedFeedback) {
            $result.text(confusedFeedback)
        } else if (streak >= 5) {
            $result.text(streakLossFeedback[Math.floor(Math.random() * streakLossFeedback.length)])
        } else {
            $result.text(incorrectFeedback[Math.floor(Math.random() * incorrectFeedback.length)])
        }
        $("#wrong-sound")[0].play()
        $result.css("color", "red")
        streak = 0
        totalQuestions++
        refreshStreak(streak)
        $("#user-answer").text(userAnswer)
        if (answers.length === 1) {
            $("#correct-answer-sign").text("Correct Answer:")
            $("#correct-answer").text(answers[0])
        } else {
            $("#correct-answer-sign").text("Correct Answers:")
            $("#correct-answer").text(answers.join(", "))
        }
        $("#answer-explanation-table").css("display", "table")
        $("#result").css("display", "block")
        //They got it wrong, so they should answer this question again two more times!
        questionArray.push(questionArray.shift()) //shift() returns the first element
        questionRep[getCurrentQuestion()] = questionRep[getCurrentQuestion()] + 2
        //Oh, and make sure to repeat it to them again as soon as we can.
        insertLocations = findQuestionSpots(getCurrentQuestion(), questionArray);
        if (insertLocations) {
            //This makes sure that if it can't find a spot, then don't iterate over undefined.
            for (let i = insertLocations.length - 1; i >= 0; i--) { //Makes sure to iterate backwards so no bugs happen
                const insertLocation = insertLocations[i]
                questionArray.splice(insertLocation, 0, getCurrentQuestion())
            }
        }
        $("#manual-grading").text("I got this correct")
        $("#manual-grading").css("background-color", "var(--manual-grading-correct-color)")
        $("#manual-grading").on("click", {ogResult: false}, manualGrading)
    }
    changeQuestionArray(questionArray) //Permanently modifies the actual array.
    $("#button-bar").css("display", "none")
    $("#next-question").css("display", "inline-block")
    $("#manual-grading").css("display", "inline-block")
    storeInLocalStorage()
}
const setUpQuestion = function (event={}) {
    //Make the answer explanation and button disappear
    if (Object.keys(event).length !== 0) {
        event.preventDefault();
    };
    $("#correct-sound")[0].pause()
    $("#correct-sound")[0].currentTime = 0
    $("#wrong-sound")[0].pause()
    $("#wrong-sound")[0].currentTime = 0
    oldStreak = streak
    $("#button-bar").css("display", "revert")
    $("#next-question").css("display", "none")
    $("#manual-grading").css("display", "none")
    $("#manual-grading").off("click")
    $("#answer-explanation-table").css("display", "none")
    $("#result").css("display", "none")
    //Poof!
    //Time to set up the next question.
    const questionArray = getQuestionArray()
    if (!questionArray[0]) { //If it is an empty string or questionArray is empty, then finish.
        $("#quiz-title").text("You're done!")
        const percent = Math.round(questionsCorrect / totalQuestions * 100)
        let feedback = "";
        if (percent === 100) {
            $("#question").css("color", "green")
            feedback = "Perfect score!"
        } else if (percent >= 90) {
            $("#question").css("color", "limegreen")
            feedback = "You aced this quiz!"
        } else if (percent >= 80) {
            $("#question").css("color", "lime")
            feedback = "Amazing job!"
        } else if (percent >= 70) {
            $("#question").css("color", "yellowgreen")
            feedback = "Almost there!"
        } else if (percent >= 60) {
                $("#question").css("color", "orange")
                feedback = "Better luck next time!"
        } else if (percent >= 50) {
                $("#question").css("color", "orangered")
                feedback = "Try again."
        } else {
                $("#question").css("color", "red")
                feedback = "You need more practice."
        }
        $("#question").text(`Your accuracy was ${percent}%. ${feedback}`)
        $("#button-bar").css("display", "none")
        $("#streak").css("display", "none")
        $("#flaming-icon").css("display", "none")
        $("#keyboard-shortcuts").css("display", "none")
        localStorage.clear()
        setTimeout(function () {
            $("#confetti").css("display", "inline")
        }, 3000)
        setTimeout(function () {
            $("#confetti").css("display", "none")
        }, 4000)
        setTimeout(function () {
            reset()
        }, 8000)
        return;
    } else {
        const question = questionArray[0]
        changeCurrentQuestion(question)
        //Look through questionRep and set the cap at 5.
        for (question in questionRep) {
            if (questionRep[question] > 5) {
                questionRep[question] = 5
            }
        }
        //Now set up the physical page
        $("#question").text(question);
        $("#form").css("display", "block");
        $("[name='answer']").val("");//sets the input box to empty
        ($('[name="answer"]')[0]).focus();
        ($('[name="answer"]')[0]).setSelectionRange(0, 0);
        //Autoselects the input box
    }
    storeInLocalStorage()
}
const setUp = function (event) {
    event.preventDefault();
    topicSelected = $("#topic-selection").val()
    refreshStreak(0);
    $("#topic-disable").prop("disabled", true)
    const questionArray = shuffleArray(Object.keys(data[courseSelected][chapterSelected][topicSelected]))
    changeQuestionArray(questionArray)
    $("#selection").css("display", "none")
    $("#content").css("display", "revert")
    
    $('#form').on("submit", checkAnswer)
    $("#next-question").on("click", setUpQuestion)
    $("#shift").on("click", shiftAll);
    $("#button-bar").css("display", "")
    const question = questionArray[0]
    changeCurrentQuestion(question)
    $("#question").text(question)
    $("#form").css("display", "block")
    $("[name='answer']").val("");
    ($('[name="answer"]')[0]).focus();
    ($('[name="answer"]')[0]).setSelectionRange(0, 0); //autoselect
    questionRep = {}
    for (let i = 0; i < questionArray.length; i++) {
        const question = questionArray[i]
        questionRep[question] = 3
    } //Makes sure each question is repeated at least 3 times
    //Now add an event listener for all members of class char using this keyword.

    $(document).on("click", ".char", function () {
            const char = $(this).text()
            const domEl = $('[name="answer"]')[0]
            const startPos = domEl.selectionStart
            const endPos = domEl.selectionEnd
            const currentVal = $(domEl).val()
            const newVal = currentVal.slice(0, startPos) + char + currentVal.slice(endPos)
            $(domEl).val(newVal)
            domEl.setSelectionRange(startPos + 1, startPos + 1)
            $(domEl).focus()
        })
    //Add some keyboard shortcuts
    $(document).on("keydown", keyboardShortcut)
    storeInLocalStorage();
}
const askUserForTopic = function (event) {
    event.preventDefault()
    chapterSelected = ($("#chapter-selection")).val()
    storeInLocalStorage()
    $("#topic-selection-form").css("display", "revert")
    $("#chapter-disable").prop("disabled", true)
    $("button.chapter-selection").css("visibility", "hidden")
    const topics = Object.keys(data[courseSelected][chapterSelected])
    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i]
        const newOption = $(`<option value="${topic}">${topic}</option>`)
        $("#topic-selection").append(newOption)
    }
    $("#topic-selection-form").one("submit", setUp)
}
const askUserForChapter = function (event) {
    event.preventDefault()
    courseSelected = $("#course-selection").val()
    storeInLocalStorage()
    $("#chapter-selection-form").css("display", "revert")
    $("#course-disable").prop("disabled", true)
    $("button.course-selection").css("visibility", "hidden")
    //The changes above made the course selection freeze. Poof!
    const chapters = Object.keys(data[courseSelected])
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const newOption = $(`<option value="${chapter}">${chapter}</option>`)
        $("#chapter-selection").append(newOption)
    }
    $("#chapter-selection-form").one("submit", askUserForTopic)
}
const askUserForCourse = function () {
    $("#content").css("display", "none");
    storeInLocalStorage()
    //Now fill the course selection with what courses are currently available.
    const courses = Object.keys(data)
    for (let i = 0; i < courses.length; i++) {
        const course = courses[i]
        const newOption = $(`<option value="${course}">${course}</option>`)
        $("#course-selection").append(newOption)
    }
    //Finally, add an event listener for when the user decides to click.
    $("#course-selection-form").one("submit", askUserForChapter)
}
$(document).ready(function() {
    $("#reset").on("click", resetButton)
    //Set up the keyboard shortcuts sign.
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    if ((windowHeight <= 695 && windowWidth <= 500) || (windowHeight <= 559 && windowWidth <= 800)) {
        $("#keyboard-shortcuts").css("display", "none")
    }
    $("audio").each(function (index, element) {
        element.volume = 0.2;
    }) //Sets the volume of the audio to 0.2, which is just above "just right".
    if (getSystemInfo().device !== "Desktop") {
        alert("You are on a non-recommended device. It is strongly recommended to use a laptop instead. A few features, especially keyboard shortcuts, are prone to glitches.")
    }
    $(document).on("copy", function (event) {
        event.preventDefault()
    })
    $(document).on("paste", function (event) {
        event.preventDefault()
        alert("Nice try! You have to type the answer, not copy and paste it.")
    })
    const state = localStorage.getItem("state")
    if (state === "selection" || !state) {
        askUserForCourse()
        return;
    } else {
        const localStorageData = getLocalStorage()
        courseSelected = localStorageData.courseSelected;
        chapterSelected = localStorageData.chapterSelected
        topicSelected = localStorageData.topicSelected
        userAnswer = localStorageData.userAnswer
        answers = localStorageData.answers
        questionRep = localStorageData.questionRep
        streak = localStorageData.streak
        oldStreak = localStorageData.oldStreak
        totalQuestions = localStorageData.totalQuestions
        questionsCorrect = localStorageData.questionsCorrect
        insertLocations = localStorageData.insertLocations
        $("#content").css("display", "revert");
        $("#selection").css("display", "none")
        changeCurrentQuestion(localStorageData.currentQuestion)
        changeQuestionArray(localStorageData.questionArray)
        $('#form').on("submit", checkAnswer)
        $("#next-question").on("click", setUpQuestion)
        $("#shift").on("click", shiftAll);
        refreshStreak(streak)
        //Add keyboard shortcuts
        $(document).on("click", ".char", function () {
                const char = $(this).text()
                const domEl = $('[name="answer"]')[0]
                const startPos = domEl.selectionStart
                const endPos = domEl.selectionEnd
                const currentVal = $(domEl).val()
                const newVal = currentVal.slice(0, startPos) + char + currentVal.slice(endPos)
                $(domEl).val(newVal)
                domEl.setSelectionRange(startPos + 1, startPos + 1)
                $(domEl).focus()
            })
        //Add some keyboard shortcuts
        $(document).on("keydown", keyboardShortcut)
        if (state === "question") {
            $("#next-question").css("display", "none")
            $("#manual-grading").css("display", "none")
            $("#answer-explanation-table").css("display", "none")
            $("#result").css("display", "none")
            $("#button-bar").css("display", "")
            $("#question").text(getCurrentQuestion());
            $("#form").css("display", "block");
            $("[name='answer']").val("");//sets the input box to empty
            ($('[name="answer"]')[0]).focus();
            ($('[name="answer"]')[0]).setSelectionRange(0, 0);
        } else if (state === "answer") {
            let $result = $("#result");
            let processedAnswers = [];
            $("#question").text(getCurrentQuestion());
            $("#form").css("display", "none");
            $("#button-bar").css("display", "none")
            $result.text(localStorageData.$resultText)
            for (let i = 0; i < answers.length; i++) {
                processedAnswers.push(processAnswer(answers[i]))
            }
            if (processedAnswers.includes(processAnswer(userAnswer))) {
                //If the user was correct, then show that they were correct.
                //However, make sure to not modify any variables...they already were modified last time.
                $result.css("color", "green")
                $result.css("display", "block")
                $("#manual-grading").text("I got this wrong");
                $("#manual-grading").css("background-color", "var(--manual-grading-wrong-color)");
                if (getQuestionArray().length <= 1 && questionRep[getCurrentQuestion()] <= 1) {
                    $("#next-question").text("Finish")
                } else {
                    $("#next-question").text("Next Question")
                }
                $("#next-question").css("display", "inline-block")
                $("#manual-grading").css("display", "inline-block")
                $("#manual-grading").on("click", {ogResult: true}, manualGrading);
            } else {
                $result.css("color", "red")
                $("#user-answer").text(userAnswer)
                if (answers.length === 1) {
                    $("#correct-answer-sign").text("Correct Answer:")
                    $("#correct-answer").text(answers[0])
                } else {
                    $("#correct-answer-sign").text("Correct Answers:")
                    $("#correct-answer").text(answers.join(", "))
                }
                $("#answer-explanation-table").css("display", "table")
                $("#result").css("display", "block")
                $("#manual-grading").text("I got this correct")
                $("#manual-grading").css("background-color", "var(--manual-grading-correct-color)")
                $("#manual-grading").on("click", {ogResult: false}, manualGrading)
                $("#next-question").css("display", "inline-block")
                $("#manual-grading").css("display", "inline-block")
            }
        } else {
            console.error("Error Document.ready function. LocalStorageData state neither question nor answer nor selection nor null/undefined.");
        }
    }
});
/*
Notes for future:
When school starts, you can process the textbook data into real questions.
Some things to keep in mind:
    Each question MUST contain only two double quotes(") for the confusion logic to work correctly
    They should wrap around the thing that should be translated into spanish(for example, 'What is "engineer(male)"?'). 
        Note that the gender/number of the nouns should be KEPT in there(otherwise it would say 'Did you confuse it with "engineer"?' if they put female instead of male)
    For verbs, there should be separate for memorizing the infinitive and memorizing the conjugations.
    For adjectives/nouns with different forms, it should be conjugated. For example, instead of asking what is engineer, it should ask what is a male engineer, mix of male and female engineers, etc.
*/