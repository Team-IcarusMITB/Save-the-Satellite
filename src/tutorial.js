let tutorialStep = 0;
let tutorialActive = false;
let highlightedElement = null;
let isKeyListenerBound = false;

const steps = [
    {
        title: 'Welcome Commander',
        text: 'Your mission is to keep the satellite alive as long as possible while orbiting Earth.',
        targetSelector: null
    },
    {
        title: '3D Space View',
        text: 'Left side is the live space view. Drag to rotate camera, scroll to zoom, and use WASD (or arrow keys) + Q/E to maneuver.',
        targetSelector: '.canvas-container'
    },
    {
        title: 'Status + Battery',
        text: 'Watch sunlight/shadow status and battery level. In shadow, battery drains faster, so power management is critical.',
        targetSelector: '.status-section'
    },
    {
        title: 'System Controls',
        text: 'Use Communications, Payload, and Camera buttons on the right. Active systems consume extra battery.',
        targetSelector: '.systems-section'
    },
    {
        title: 'Faults + Debris',
        text: 'Fix faults quickly using Restart System and avoid debris collisions. Too many hits or zero battery ends the mission.',
        targetSelector: '.faults-section'
    },
    {
        title: 'You Are Ready',
        text: 'Press Next (or Enter) to begin. Good luck, Commander!'
    }
];

export function forceNextStep() {
    if (!tutorialActive) return;

    tutorialStep += 1;
    if (tutorialStep >= steps.length) {
        endTutorial();
        return;
    }

    updateStep();
}

export function startTutorial() {
    tutorialStep = 0;
    tutorialActive = true;

    const overlay = document.getElementById('tutorialOverlay');
    if (!overlay) {
        tutorialActive = false;
        return;
    }

    bindEnterKeyOnce();
    overlay.classList.remove('hidden');
    updateStep();
}

function bindEnterKeyOnce() {
    if (isKeyListenerBound) return;

    window.addEventListener('keydown', (event) => {
        if (!tutorialActive) return;
        if (event.key !== 'Enter') return;

        event.preventDefault();
        forceNextStep();
    });

    isKeyListenerBound = true;
}

function clearHighlight() {
    if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
        highlightedElement = null;
    }
}

function applyHighlight(selector) {
    clearHighlight();
    if (!selector) return;

    const element = document.querySelector(selector);
    if (!element) return;

    element.classList.add('tutorial-highlight');
    highlightedElement = element;
}

function updateStep() {
    const step = steps[tutorialStep];
    if (!step) return;

    const titleEl = document.getElementById('tutorialTitle');
    const textEl = document.getElementById('tutorialText');
    const progressEl = document.getElementById('tutorialProgress');
    const nextBtn = document.getElementById('tutorialNext');

    if (titleEl) titleEl.textContent = step.title;
    if (textEl) textEl.textContent = step.text;
    if (progressEl) progressEl.textContent = `Step ${tutorialStep + 1} / ${steps.length}`;
    if (nextBtn) {
        nextBtn.textContent = tutorialStep === steps.length - 1 ? 'Start Mission' : 'Next';
    }

    applyHighlight(step.targetSelector || null);
}

export function updateTutorial() {
    // Kept for compatibility with main loop; tutorial progression is now manual.
}

function endTutorial() {
    tutorialActive = false;
    clearHighlight();

    const overlay = document.getElementById('tutorialOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

export function isTutorialActive() {
    return tutorialActive;
}