"use strict";
// @ts-check
// global LZString
/*
Welcome to the brain of the spanish quizzer! Note that the "data" object is a global variable and so are correctFeedback, wrongFeedback and streakLossFeedback because they are in data.js which is loaded in the html before this script is. jQuery is loaded in here too.
*/ 
/*
Notes for future:
If the user has an existing quiz make sure to remind them that they are overriding it with a new quiz.

Add a saved! thing that notifies the user when they successfully save it, and that disappears the moment they modify something.
Same for file thing.
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
let dailyStreak = 0;
const ANIMATION_LENGTH =  100
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
    $("#quiz-box").attr("data-current-question", newQuestion)
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
    let renderingEngine = "Unknown"
    if (window.chrome && typeof window.chrome === "object") {
        renderingEngine = "Blink"
    } else if (window.netscape || "mozGetUserMedia" in navigator) {
        renderingEngine = "Gecko"
    } else {
        renderingEngine = "WebKit"
    }
    info["renderingEngine"] = renderingEngine
    return info;
}
const processAnswer = function (answer, removePunctuation=true, removeSpaces=true) {
    answer = answer.toLowerCase()
    if (removeSpaces) {
        answer = answer.replaceAll(" ", "") //Removes all spaces.
    }
    //Remove all other weird symbols.
    answer = answer.replace(/[^a-z0-9áéíóúüñ!?¡¿.,]/gi, "")
    if (removePunctuation) {
        answer = answer.replace(/[!?¡¿.,]/gi, "")
    }
    return answer
}
const insertChar = function (char, deletePrevious=false) {
    const domEl = $("#answer-input")[0]
    if ($(domEl).css("display") === "none") {
        return; //If the domEl is hidden why add something to it?
    }
    const startPos = domEl.selectionStart
    const endPos = domEl.selectionEnd
    const currentVal = $(domEl).val()
    const newVal = currentVal.slice(0, deletePrevious ? Math.max(startPos - 1, 0) : startPos) + char + currentVal.slice(endPos)
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
                        if ($("#answer-input").val()) {
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
                    break;
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
                        if ($("#answer-input").val()) {
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
const storeInLocalStorage = function (state) {
    /* Why does everything start with "spanish-quizzer-"?
    localStorage is stored in the origin, the first part of the url encompassing the mydomain.extension.
    Which means if I host something else on the same thing, I might override THEIR localStorage or vice versa.*/
    if (state == undefined) {
        throw new Error("State undefined!")
    } 
    const now = new Date()
    let keyValue = {
        "spanish-quizzer-textarea": state === "creation" ? $("#custom-quiz-input").val() : "",
        "spanish-quizzer-textarea-title": state === "creation" ? $("#custom-quiz-title-input").val() : "",
        "spanish-quizzer-state": state,
        "spanish-quizzer-courseSelected": courseSelected,
        "spanish-quizzer-chapterSelected": chapterSelected,
        "spanish-quizzer-topicSelected": topicSelected,
        "spanish-quizzer-answers": JSON.stringify(answers),
        "spanish-quizzer-userAnswer": userAnswer,
        "spanish-quizzer-questionRep": JSON.stringify(questionRep),
        "spanish-quizzer-streak": JSON.stringify(streak),
        "spanish-quizzer-oldStreak": JSON.stringify(oldStreak),
        "spanish-quizzer-currentQuestion": getCurrentQuestion(),
        "spanish-quizzer-questionArray": JSON.stringify(getQuestionArray()),
        "spanish-quizzer-totalQuestions": String(totalQuestions),
        "spanish-quizzer-questionsCorrect": String(questionsCorrect),
        "spanish-quizzer-insertLocations": JSON.stringify(insertLocations),
        "spanish-quizzer-$resultText": $("#result").text(),
        "spanish-quizzer-daily-streak": String(dailyStreak),
        "spanish-quizzer-user-created-quizzes": JSON.stringify(data["Custom Quizzes"] ? data["Custom Quizzes"] : {}),
        // Store the date.
        "spanish-quizzer-year-last-visited": String(now.getFullYear()),
        "spanish-quizzer-month-last-visited": String(now.getMonth()),
        "spanish-quizzer-day-last-visited": String(now.getDate()),
    }
    for (const key in keyValue) {
        if (localStorage.getItem(key) !== keyValue[key]) {
            localStorage.setItem(key, keyValue[key])
        }
    }
    //This stores EVERYTHING in localstorage, useful or not.
}
const getLocalStorage = function () {
    try {
        const storage =  {
            "state":localStorage.getItem("spanish-quizzer-state"),
            "courseSelected":localStorage.getItem("spanish-quizzer-courseSelected"),
            "chapterSelected":localStorage.getItem("spanish-quizzer-chapterSelected"),
            "topicSelected":localStorage.getItem("spanish-quizzer-topicSelected"),
            "answers":JSON.parse(localStorage.getItem("spanish-quizzer-answers")),
            "userAnswer":localStorage.getItem("spanish-quizzer-userAnswer"),
            "questionRep":JSON.parse(localStorage.getItem("spanish-quizzer-questionRep")),
            "streak":JSON.parse(localStorage.getItem("spanish-quizzer-streak")),
            "oldStreak":JSON.parse(localStorage.getItem("spanish-quizzer-oldStreak")),
            "currentQuestion":localStorage.getItem("spanish-quizzer-currentQuestion"),
            "questionArray":JSON.parse(localStorage.getItem("spanish-quizzer-questionArray")),
            "totalQuestions":Number(localStorage.getItem("spanish-quizzer-totalQuestions")),
            "questionsCorrect":Number(localStorage.getItem("spanish-quizzer-questionsCorrect")),
            "insertLocations":JSON.parse(localStorage.getItem("spanish-quizzer-insertLocations")),
            "$resultText":localStorage.getItem("spanish-quizzer-$resultText"),
            "userCreatedQuizzes": JSON.parse(localStorage.getItem("spanish-quizzer-user-created-quizzes")),
            "dailyStreak": parseInt(localStorage.getItem("spanish-quizzer-daily-streak")),
            "year": parseInt(localStorage.getItem("spanish-quizzer-year-last-visited")),
            "month": parseInt(localStorage.getItem("spanish-quizzer-month-last-visited")),
            "day": parseInt(localStorage.getItem("spanish-quizzer-day-last-visited")),
            "textarea": localStorage.getItem("spanish-quizzer-textarea"),
            "textareaTitle": localStorage.getItem("spanish-quizzer-textarea-title"),
        }
        if (Object.values(storage).includes(null)) {
            const nonEmptyValues = {state:"selection", "userCreatedQuizzes": JSON.parse(localStorage.getItem("spanish-quizzer-user-created-quizzes")),
            "dailyStreak": parseInt(localStorage.getItem("spanish-quizzer-daily-streak")),
            "year": parseInt(localStorage.getItem("spanish-quizzer-year-last-visited")),
            "month": parseInt(localStorage.getItem("spanish-quizzer-month-last-visited")),
            "day": parseInt(localStorage.getItem("spanish-quizzer-day-last-visited")),
            "textarea": localStorage.getItem("spanish-quizzer-textarea"),
            "textareaTitle": localStorage.getItem("spanish-quizzer-textarea-title"),
            }
            if (Object.values(nonEmptyValues).includes(null)) {
                console.error("localStorage data has been corrupted", nonEmptyValues)
                return {"state": "selection"}
            }
            return nonEmptyValues
        }
        return storage;
    } catch (error) {
        console.error("Failed to fetch localStorage data", error)
        return {
            state:"selection"
        }
    }
}
const clearLocalStorage = function () {
    /* 
    Why can't I use localStorage.clear()?
    localStorage is stored in the origin, the first part of the url encompassing the mydomain.extension.
    Which means if I host something else on the same thing, I might delete THEIR localStorage or vice versa. This provides a degree of security because if they are far less likely to have a key called "spanish-quizzer-answers" than "answers".
    */
    localStorage.removeItem("spanish-quizzer-state")
    localStorage.removeItem("spanish-quizzer-courseSelected")
    localStorage.removeItem("spanish-quizzer-chapterSelected")
    localStorage.removeItem("spanish-quizzer-topicSelected")
    localStorage.removeItem("spanish-quizzer-answers")
    localStorage.removeItem("spanish-quizzer-userAnswer")
    localStorage.removeItem("spanish-quizzer-questionRep")
    localStorage.removeItem("spanish-quizzer-streak")
    localStorage.removeItem("spanish-quizzer-oldStreak")
    localStorage.removeItem("spanish-quizzer-currentQuestion")
    localStorage.removeItem("spanish-quizzer-questionArray")
    localStorage.removeItem("spanish-quizzer-totalQuestions")
    localStorage.removeItem("spanish-quizzer-questionsCorrect")
    localStorage.removeItem("spanish-quizzer-insertLocations")
    localStorage.removeItem("spanish-quizzer-$resultText")
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
const exportData = function (data, filename) {
    const blob = new Blob([data], {type:"application/json"})
    const url = URL.createObjectURL(blob)
    // Create a link and add it to the DOM, then click it and immediately remove it.
    const link = $(`<a href=${url} download=${filename}></a>`)
    link.appendTo("body")
    link[0].click();
    link.remove();
    URL.revokeObjectURL(url);
}
const processUserQuiz = function (string) {
    if (string.trim().length === 0) {
        return "You didn't enter anything."
    }
    const lines = string.split("\n")
    let currentQuestion = ""
    let currentAnswers = []
    let quizObject = {}
    let isFirstQuestion = true
    for (let line of lines) {
        line = line.trim()
        if (line.length === 0) {
            // The line is empty, so continue.
            continue;
        }
        if (line.startsWith("##")) {
            if (currentAnswers.length === 0 && currentQuestion.length > 0) {
                return "One question has no answers for it."
            } else {
                if (currentQuestion.length > 0 || (isFirstQuestion && line.trim() != "##")) {
                    if (!isFirstQuestion) {
                        quizObject[currentQuestion] = currentAnswers
                    }
                    isFirstQuestion = false
                    currentQuestion = line.slice(2, line.length).trim()
                    currentAnswers = []
                } else if (currentQuestion.length === 0) {
                    return "One of your questions is empty."
                }
            }
        } else if (line.startsWith("==")) {
            const answer = line.slice(2, line.length).trim()
            if (answer.length > 0) {
                currentAnswers.push(answer)
            } else {
                return "One of your answers is empty."
            }
        } else {
            return "Your input is invalid."
        }
    }
    if (currentQuestion.length > 0 && currentAnswers.length > 0) {
        quizObject[currentQuestion] = currentAnswers
    } else {
        return ((currentQuestion.length === 0 && currentAnswers.length === 0) 
        ? "You left a ## at the end." : currentQuestion.length === 0
        ? "The last question is empty." : "There are no answers given for the last question.")
    }
    return quizObject
}
const customQuizDialogSubmit = function (event) {
    event.preventDefault()
    const processedQuiz = processUserQuiz($("#custom-quiz-input").val())
    if (typeof processedQuiz === "string") {
        $("#custom-quiz-invalid-warning").text("Error: " + processedQuiz)
        $("#custom-quiz-copy-link").prop("disabled", true).attr("title", "Please fix the issue and save the quiz first.").off()
        $("#custom-quiz-export").prop("disabled", true).attr("title", "Please fix the issue and save the quiz first.").off()
        return;
    } else if (typeof processedQuiz === "object") {
        const title = $("#custom-quiz-title-input").val()
        if (!title) {
            $("#custom-quiz-invalid-warning").text("Please enter a title for your custom quiz.")
            return;
        }
        $("#custom-quiz-invalid-warning").text("")
        if (data["Custom Quizzes"]) {
            if (data["Custom Quizzes"]["Quizzes"]) {
                // If the user has already created a couple of question sets, add this to that.
                data["Custom Quizzes"]["Quizzes"][title] = processedQuiz
            }
        } else {
            // Create a new Custom Quizzes object in data if there isn't one.
            data["Custom Quizzes"] = {}
            data["Custom Quizzes"]["Quizzes"] = {}
            data["Custom Quizzes"]["Quizzes"][title] = processedQuiz
        }
        navigator.storage.persisted().then((wasAccepted) => {
            if (!wasAccepted) {
                navigator.storage.persist().then(isAccepted => {
                    if (!isAccepted) {
                        if (getSystemInfo().renderingEngine === "WebKit") {
                            alert("Permanent save failed.\n\nThis means that your custom quizzes may be deleted occasionally. It is highly recommended to copy the link and save it so that your custom quiz isn't lost forever.")
                        }
                    }
                })
            }
        });
        const encodedQuiz = LZString.compressToEncodedURIComponent(JSON.stringify({[title]:processedQuiz}))
        let baseUrl = window.location.origin + window.location.pathname
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.slice(0, -1) // Otherwise the browser would thing that the hash is actually a location and throw a 404 Not Found error.
        }
        const fullUrl = `${baseUrl}#${encodedQuiz}`
        if (fullUrl.length < 2048) {
            $("#custom-quiz-copy-link").removeAttr("disabled").removeAttr("title").off("click").on("click", (event) => {
                event.preventDefault()
                navigator.clipboard.writeText(fullUrl)
                .then(() => {
                    $("#custom-quiz-copy-link").text("Copied successfully!")
                    setTimeout(() => $("#custom-quiz-copy-link").text("Copy link"), 5000)
                })
                .catch(() => {
                    alert("Copying failed. Please copy this URL manually: " + fullUrl)
                });
            })
            $("#custom-quiz-export").removeAttr("disabled").removeAttr("title").off("click").on("click", (event) => {
                // We don't compress it for readability purposes.
                exportData(JSON.stringify({[title]:processedQuiz}), `${title.replaceAll(" ", "_")}.quiz.json`)
                $("#custom-quiz-export").text("Successfully exported!")
                setTimeout(() => $("#custom-quiz-export").text("Export as file"), 5000)
            })
        } else {
            $("#custom-quiz-invalid-warning").text("Your quiz is too long to turn into a link.")
            $("#custom-quiz-copy-link").off().prop("disabled", true).attr("title", "Your quiz is too long to turn into a link. To generate a link, please shorten it.")
        }
        storeInLocalStorage("creation")
        $("#custom-quiz-input-submit").text("Saved!")
        setTimeout(() => $("#custom-quiz-input-submit").text("Save"), 5000)
    }
}
const findQuestionSpots = function (question, array) {
    // This returns either an array of indexes to insert, or undefined.
    // It returns an array of 2
    if (!array.includes(question)) {
        if (array.length >= 6) {
            return [2, 5];
        } else {
            return [];
        };
    };
    if (array.length <= 3) {
        return [];
    };
    const bufferLength = 2;
    const startingBuffer = 2;
    let candidates = [];
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
        return [];
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
    let stateBeforeReset = "quiz"
    if ($("#selection").css("display") != "none") {
        stateBeforeReset = "selection"
    }
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
    $("*:not(.no-listener-clear)").off(); // KILL THE EVENT LISTENERS!
    //Clear localStorage.
    clearLocalStorage();
    // Make sure to add the default required element though.
    $("#course-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    $("#chapter-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    $("#topic-selection").append("<option value='' disabled selected hidden>Please select an option</option>");
    if (stateBeforeReset === "selection") {
        // If the user is taking a quiz and presses 'reset' they don't want to see the selection page in between the animation.
        $("#selection").fadeOut(ANIMATION_LENGTH)
    } else {
        $("#selection").css("display", "none")
    }
    if (dailyStreak < 5) {
        $("#daily-streak-flaming-icon").css("display", "none")
    } else {
        $("#daily-streak").css("color", "red")
    }
    $("#streak").fadeOut(ANIMATION_LENGTH, () => $("#start").fadeIn(ANIMATION_LENGTH))
    $("#keyboard-shortcuts").fadeOut(ANIMATION_LENGTH)
    $("#start-button").one("click", askUserForCourse)
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
    userAnswer = ($("#answer-input").val()).trim().toLowerCase()
    if (userAnswer.length === 0) {
        return; //Makes sure to not count empty accidental answers.
    }
    answers = data[courseSelected][chapterSelected][topicSelected][getCurrentQuestion()];
    let $result = $("#result");
    let questionArray = getQuestionArray();
    let processedAnswers = []
    for (let i = 0; i < answers.length; i++) {
        processedAnswers.push(processAnswer(answers[i]))
    }
    if (processedAnswers.includes(processAnswer(userAnswer))) {
        //It's correct!
        $result.text(correctFeedback[Math.floor(Math.random() * correctFeedback.length)]);
        $result.css("color", "green")
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
        if (questionArray.length === 0 && questionRep[getCurrentQuestion()] <= 0) {
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
        setTimeout(() => {
            $("#answer-explanation-table").fadeIn(ANIMATION_LENGTH)
        }, ANIMATION_LENGTH)
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
    $("#button-bar").fadeOut(ANIMATION_LENGTH)
    $("#form").fadeOut(ANIMATION_LENGTH, () => {
        $("#result").fadeIn(ANIMATION_LENGTH)
        $("#next-question").fadeIn(ANIMATION_LENGTH)
        $("#manual-grading").fadeIn(ANIMATION_LENGTH)
    });
    storeInLocalStorage("answer")
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
    $("#next-question").fadeOut(ANIMATION_LENGTH)
    $("#manual-grading").fadeOut(ANIMATION_LENGTH)
    $("#manual-grading").off("click")
    $("#answer-explanation-table").fadeOut(ANIMATION_LENGTH)
    $("#result").fadeOut(ANIMATION_LENGTH)
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
        $("#button-bar").fadeOut(ANIMATION_LENGTH)
        $("#streak").fadeOut(ANIMATION_LENGTH)
        $("#flaming-icon").fadeOut(ANIMATION_LENGTH)
        $("#keyboard-shortcuts").fadeOut(ANIMATION_LENGTH, () => $("#credits").fadeIn(ANIMATION_LENGTH))
        clearLocalStorage();
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
        for (const q in questionRep) {
            if (questionRep[q] > 5) {
                questionRep[q] = 5
            }
        }
        $("#question").text(question);
        setTimeout(() => {
            $("#form").fadeIn(ANIMATION_LENGTH)
            $("#button-bar").fadeIn(ANIMATION_LENGTH)
        }, ANIMATION_LENGTH)
        $("#answer-input").val("");//sets the input box to empty
        setTimeout(() => {
            ($("#answer-input")[0]).focus();
            ($("#answer-input")[0]).setSelectionRange(0, 0);
        }, ANIMATION_LENGTH)
        //Autoselects the input box
    }
    storeInLocalStorage("question")
}
const setUp = function (event={}) {
    if (Object.keys(event).length > 0) {
        event.preventDefault();
        topicSelected = $("#topic-selection").val()
    }
    refreshStreak(0);
    $("#topic-disable").prop("disabled", true)
    const questionArray = shuffleArray(Object.keys(data[courseSelected][chapterSelected][topicSelected]))
    changeQuestionArray(questionArray)
    $("#selection").fadeOut(ANIMATION_LENGTH, () => {
        $("#content").fadeIn(ANIMATION_LENGTH)
        $("#keyboard-shortcuts").fadeIn(ANIMATION_LENGTH)
        $("#streak").fadeIn(ANIMATION_LENGTH)
        $("#button-bar").fadeIn(ANIMATION_LENGTH)
        $("#form").fadeIn(ANIMATION_LENGTH)
    })
    $('#form').on("submit", checkAnswer)
    $("#next-question").on("click", setUpQuestion)
    $("#shift").on("click", shiftAll);
    const question = questionArray[0]
    changeCurrentQuestion(question)
    $("#question").text(question)
    $("#answer-input").val("");
    ($("#answer-input")[0]).focus();
    ($("#answer-input")[0]).setSelectionRange(0, 0); //autoselect
    questionRep = {}
    for (let i = 0; i < questionArray.length; i++) {
        const question = questionArray[i]
        questionRep[question] = 3
    } //Makes sure each question is repeated at least 3 times
    //Now add an event listener for all members of class char using this keyword.

    $(document).on("click", ".char", function () {
            const char = $(this).text()
            const domEl = $("#answer-input")[0]
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
    storeInLocalStorage("question");
}
const askUserForTopic = function (event) {
    event.preventDefault()
    chapterSelected = ($("#chapter-selection")).val()
    storeInLocalStorage("selection")
    $("#topic-selection-form").fadeIn(ANIMATION_LENGTH)
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
    storeInLocalStorage("selection")
    $("#chapter-selection-form").fadeIn(ANIMATION_LENGTH)
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
    $("#start").fadeOut(ANIMATION_LENGTH, () => {
        $("#reset").fadeIn(ANIMATION_LENGTH)
        $("#selection").fadeIn(ANIMATION_LENGTH)
    })
    storeInLocalStorage("selection")
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
    $("#custom-quiz-button").on("click", event => {
        event.preventDefault()
        $("#custom-quiz-copy-link").prop("disabled", true).text("Copy link").attr("title", "Please first save your quiz.").off()
        $("#custom-quiz-export").prop("disabled", true).text("Export as file").attr("title", "Please first save your quiz.").off()
        $("#custom-quiz-input-submit").text("Save")
        $("#user-question-dialog")[0].showModal()
        const oldTextArea = getLocalStorage().textarea
        const oldTitle = getLocalStorage().textareaTitle
        if (oldTextArea || oldTitle) {
            $("#custom-quiz-input").val(oldTextArea)
            $("#custom-quiz-title-input").val(oldTitle)
        }
    });
    $("#user-question-dialog").on("click", function (event) {
        if (event.target === this) {
            storeInLocalStorage("selection")
            this.close();
        }
    });
    $("#close-dialog").on("click", function () {
        storeInLocalStorage("selection")
        $("#user-question-dialog")[0].close();
    });
    $("#custom-quiz-input-submit").on("click", customQuizDialogSubmit);
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
        $("#keyboard-shortcuts")[0].remove()
        $("#logo")[0].remove()
        // Gives the browser some time to remove the keyboard shortcuts so that they don't even exist in memory.
        setTimeout(function () {
        alert("You are on a non-recommended device. It is strongly recommended to use a laptop instead.")}, 50)
    }
    $(document).on("cut", function (event) {
        event.preventDefault()
    })
    $(document).on("copy", function (event) {
        event.preventDefault()
    })
    $(document).on("paste", function (event) {
        event.preventDefault()
        alert("Nice try! You have to type the answer, not copy and paste it.")
    })
    $(document).on("dragstart", function (event) {
        event.preventDefault()
    })
    let timeoutId;
    $(document).on("keydown", () => {
        // This only saves if the user pauses for 300ms, which helps save resources.
        if (!$("#user-question-dialog")[0].open) {
            return;
        }
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => storeInLocalStorage("creation"), 300)
    });
    const localStorageData = getLocalStorage()
    if (localStorageData.userCreatedQuizzes != undefined) {
        if (Object.keys(localStorageData.userCreatedQuizzes).length > 0) {
            data["Custom Quizzes"] = localStorageData.userCreatedQuizzes
        }
    }
    const state = localStorageData.state
    const lastVisited = new Date(localStorageData.year, localStorageData.month, localStorageData.day);
    const today = new Date()
    const differenceInDays = Math.floor((today - lastVisited) / (1000 * 60 * 60 * 24));
    if (differenceInDays > 1) {
        dailyStreak = 0
    } else if (differenceInDays === 1){
        dailyStreak = localStorageData.dailyStreak + 1;
    } else {
        dailyStreak = localStorageData.dailyStreak
    }
    if (isNaN(dailyStreak) || dailyStreak == undefined) {
        dailyStreak = 0
    }
    $("#daily-streak").text(String(dailyStreak));
    if (dailyStreak < 5) {
        $("#daily-streak-flaming-icon").css("display", "none")
    } else {
        $("#daily-streak").css("color", "red")
    }
    if (window.location.hash) {
        const rawHash = window.location.hash
        let processedHash;
        try {
            processedHash = JSON.parse(LZString.decompressFromEncodedURIComponent(rawHash.substring(1))) // .substring() removes the leading #.
            if (processedHash == null || typeof processedHash !== "object" || Object.keys(processedHash).length === 0) {
                throw new Error("Hash invalid!")
            }
        } catch (error) {
            console.error(error)
            setTimeout(() => alert("Your link is invalid. Make sure not to delete anything from the original link."), 100)
            reset();
            return;
        }
        courseSelected = "Custom Quizzes";
        chapterSelected = "Quizzes";
        const title = Object.keys(processedHash)[0]
        const quiz = Object.values(processedHash)[0]
        topicSelected = title
        if (data["Custom Quizzes"]) {
            if (data["Custom Quizzes"]["Quizzes"]) {
                data["Custom Quizzes"]["Quizzes"][title] = quiz
            } else {
                data["Custom Quizzes"]["Quizzes"] = {}
                data["Custom Quizzes"]["Quizzes"][title] = quiz
            }
        } else {
            data["Custom Quizzes"] = {}
            data["Custom Quizzes"]["Quizzes"] = {}
            data["Custom Quizzes"]["Quizzes"][title] = quiz
        }
        // Now that it is stored in the data, let's begin our quiz.
        setUp();
        return;
    }
    if (state === "selection" || state === "creation" || !state) {
        $("#start").css("display", "block")
        $("#start-button").one("click", askUserForCourse)
        $("#selection").css("display", "none")
        if (state === "creation") {
            $("#custom-quiz-button").trigger("click")
        }
        return;
    } else {
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
        $("#keyboard-shortcuts").css("display", "revert")
        $("#streak").css("display", "revert")
        $("#reset").css("display", "revert")
        changeCurrentQuestion(localStorageData.currentQuestion)
        changeQuestionArray(localStorageData.questionArray)
        $('#form').on("submit", checkAnswer)
        $("#next-question").on("click", setUpQuestion)
        $("#shift").on("click", shiftAll);
        refreshStreak(streak)
        //Add keyboard shortcuts
        $(document).on("click", ".char", function () {
                const char = $(this).text()
                const domEl = $("#answer-input")[0]
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
            $("#answer-input").val("");//sets the input box to empty
            ($("#answer-input")[0]).focus();
            ($("#answer-input")[0]).setSelectionRange(0, 0);
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
                if (getQuestionArray().length <= 1 && questionRep[getCurrentQuestion()] <= 0) {
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
            throw new Error("Error Document.ready function. LocalStorageData state neither question nor answer nor selection nor creation nor null/undefined.");
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
