let images = {}; // Downloaded images, keyed by index
let imagePaths = []; // Relative URL to images e.g. ["assets/2024-05-30.png", ...]
let imageQueue = []; // Image indices, sorted by proximity to the slider position. 
let maxIndex = 0;    // Max slider position
let currentIndex = 0; // Index of currently displayed image
let requestedIndex = 0; // Current slider position

let intervalId = null; // For slideshow timing

let downloadPromises = {}; // Currently running promises for image downloads, keyed on index
let abortControllers = {}; // To store AbortController for each download

let inflightDownloadCount = 0; // Number of inflight GET requests

const maxConcurrentDownloads = 10; // Allow this many inflight GET requests

const slider = document.getElementById('photo-slider');
const sliderLabel = document.getElementById('slider-label');
const canvas = document.getElementById('photo-canvas');
const canvasContext = canvas.getContext('2d');

const playButton = document.getElementById('play-button')
const pauseButton = document.getElementById('pause-button')
const prevButton = document.getElementById('prev-button')
const nextButton = document.getElementById('next-button')
const speedSelect = document.getElementById('speed-select');

const handleSliderChanged = () => {
    const index = parseInt(slider.value);
    prioritizeNear(index);
    scheduleUpdateImage(index);
};

slider.addEventListener('input', handleSliderChanged);
slider.addEventListener('change', handleSliderChanged);

prevButton.addEventListener('click', () => {
    changeImage(-1);
});

nextButton.addEventListener('click', () => {
    changeImage(1);
});

playButton.addEventListener('click', () => {
    playSlideShow();
});

pauseButton.addEventListener('click', () => {
    clearInterval(intervalId);
    intervalId = null;
    toggleButtons(); 
});

speedSelect.addEventListener('change', () => {
    if (intervalId !== null) { 
        playSlideShow();
    }
});

// Load image paths from JSON file
fetch('assets/index.json')
    .then(response => response.json())
    .then(data => {
        imagePaths = data;
        imageQueue = createImageQueue(imagePaths.length);

        // Start slider at the most recent image
        maxIndex = imagePaths.length - 1;
        slider.max = maxIndex;
        slider.value = maxIndex; 

        // Kick off downloading, starting from the end
        prioritizeNear(maxIndex);

        toggleButtons(); // Initially disable the pause button
    })
    .catch(error => console.error('Error loading the photos:', error));

function createImageQueue(length) {
    const indices = [];
    for (let i = 0; i < length; i++) {
        indices.push(i);
    }
    return indices;
}

function downloadNext() {
    enqueueDownloads(imageQueue);
}

function enqueueDownloads(imageQueue) {
    while (Object.keys(downloadPromises).length < maxConcurrentDownloads && imageQueue.length > 0) {
        const index = imageQueue.shift();
        downloadPromises[index] = downloadImage(index);
    }
}

function downloadImage(index) {
    if (index in images) { return; } // Already downlaod

    const imageUrl = `assets/${imagePaths[index]}`;

    inflightDownloadCount++;
    const controller = new AbortController();
    abortControllers[index] = controller;

    return fetch(imageUrl, { signal: controller.signal })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch image at ${imageUrl}`);
            }
            return response.blob();
        })
        .then(blob => createImageBitmap(blob))
        .then(imgBitmap => {
            images[index] = imgBitmap;

            inflightDownloadCount--;
            delete downloadPromises[index];
            delete abortControllers[index];

            // Show the image the slider position soon as it downloads
            const shouldShow = index === requestedIndex;

            if (shouldShow) {
                scheduleUpdateImage(index);
            }

            downloadNext(); // Start the next download
        })
        .catch(error => {
            if (error.name !== 'AbortError') {
                console.error(error);
            }

            inflightDownloadCount--;
            delete downloadPromises[index];
            delete abortControllers[index];

            imageQueue.push(index); // Put back on the queue for later download
            downloadNext(); // Start the next download
        });
}

function prioritizeNear(index) {

    requestedIndex = index;

    if (index in images) { return; } // Already downloaded

    // Cancel in-flight requests 
    for (const key in abortControllers) {
        if (key in downloadPromises) { continue; } // Will download soon

        abortControllers[key].abort();
        delete abortControllers[key];
    }

    imageQueue = reprioritize(imageQueue, index);
    downloadNext();
}

// Sort the image indices by their distance to the slider position.
// e.g. slider value is 25 and input is [1, 2, 3, ...30]
//   => [25, 24, 26, 23, 27, ...]
function reprioritize(indices, sliderValue) {
    return indices.sort((a, b) => Math.abs(a - sliderValue) - Math.abs(b - sliderValue));
}

function changeImage(direction) {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < imagePaths.length) {
        scheduleUpdateImage(newIndex);
    }
}

function scheduleUpdateImage(index) {
    // Slider stays snappy
    // when we update in some next
    // animation frame
    requestAnimationFrame(() => {
        updateImage(index);
    });
}

function updateImage(index) {
    const img = images[index];
    if (img == null) { return; }
   
    // Clear canvas and draw the new image
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = img.width;
    canvas.height = img.height;
    canvasContext.drawImage(img, 0, 0);

    slider.value = index;
    sliderLabel.textContent = `${index + 1} of ${imagePaths.length}`;

    currentIndex = index;
}

// Function to start the slideshow
function playSlideShow() {
    const interval = parseInt(speedSelect.value);
    clearInterval(intervalId); // Clear existing interval to reset the speed

    if (currentIndex == maxIndex) {
        slider.value = 0;
        currentIndex = 0;
        prioritizeNear(0);
    }

    intervalId = setInterval(() => {
        if (currentIndex < imagePaths.length - 1) {
            changeImage(1);
        } else {
            clearInterval(intervalId); // Stop at the last image
            intervalId = null;
            toggleButtons(); // Update button states when stopped automatically
        }
    }, interval);
    toggleButtons(); // Update button states when play is clicked
}

function toggleButtons() {
    const isPlaying = intervalId !== null;
    playButton.disabled = isPlaying;
    pauseButton.disabled = !isPlaying;
}
