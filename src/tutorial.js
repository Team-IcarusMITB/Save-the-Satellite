let tutorialStep = 0;
let tutorialActive = true;

const steps = [
    {
        text: "Press W to move forward",
        check: () => window.tutorialState.moved
    },
    {
        text: "Toggle Communications system",
        check: () => window.tutorialState.commsUsed
    },
    {
        text: "Avoid debris (just wait a moment...)",
        check: () => window.tutorialState.waited
    },
    {
        text: "Good. Survive as long as possible.",
        check: () => true
    }
];
export function forceNextStep() {
    tutorialStep++;

    if (tutorialStep >= steps.length) {
        endTutorial();
    } else {
        updateStep();
    }
}
export function startTutorial() {
    tutorialStep = 0;
    tutorialActive = true;

    // global state tracker
    window.tutorialState = {
        moved: false,
        commsUsed: false,
        waited: false
    };

    document.getElementById('tutorialOverlay').style.display = 'block';
    updateStep();

    // auto wait trigger
    setTimeout(() => {
        if (window.tutorialState) {
            window.tutorialState.waited = true;
        }
    }, 3000);
}

function updateStep() {
    document.getElementById('tutorialText').textContent = steps[tutorialStep].text;
}

export function updateTutorial() {
    if (!tutorialActive) return;

    const step = steps[tutorialStep];

    if (step.check()) {
        tutorialStep++;

        if (tutorialStep >= steps.length) {
            endTutorial();
        } else {
            updateStep();
        }
    }
}

function endTutorial() {
    tutorialActive = false;
    document.getElementById('tutorialOverlay').style.display = 'none';
}

export function isTutorialActive() {
    return tutorialActive;
}