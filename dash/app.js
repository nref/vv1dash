let imagePaths = []; // Relative URL to images e.g. ["assets/2024-05-30.png", ...]
let imageQueue = []; // Image indices, sorted by proximity to the slider position. 
let maxIndex = 0;    // Max slider position
let currentIndex = 0; // Index of currently displayed image
let requestedIndex = 0; // Current slider position

let intervalId = null; // For slideshow timing

let downloadQueue = []; // List of currently running promises for image downloads
let activeDownloads = 0;
const maxConcurrentDownloads = 1;

const slider = document.getElementById('photo-slider');
const sliderLabel = document.getElementById('slider-label');
const canvas = document.getElementById('photo-canvas');
const canvasContext = canvas.getContext('2d');

const playButton = document.getElementById('play-button')
const pauseButton = document.getElementById('pause-button')
const prevButton = document.getElementById('prev-button')
const nextButton = document.getElementById('next-button')
const speedSelect = document.getElementById('speed-select');

slider.addEventListener('input', () => {
    const index = parseInt(slider.value);

    prioritizeNear(index);
    scheduleUpdateImage(index);
});

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
        images = new Array(imagePaths.length).fill(null);

        // Start slider at the most recent image
        maxIndex = imagePaths.length - 1;
        slider.max = maxIndex;
        slider.value = maxIndex; 
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

function enqueueDownloads(imageQueue) {
    while (downloadQueue.length < maxConcurrentDownloads && imageQueue.length > 0) {
        const index = imageQueue.shift();
        downloadQueue.push(downloadImage(index));
    }
}

function dequeueDownload() {
    downloadQueue.shift();
    enqueueDownloads(imageQueue);
}

function downloadImage(index) {
    if (images[index] !== null) { return; }

    activeDownloads++;
    const imageUrl = `assets/${imagePaths[index]}`;
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            images[index] = img;
            activeDownloads--;

            // Show the image the slider position soon as it downloads
            const shouldShow = index === requestedIndex

            if (shouldShow) {
                updateImage(index);
            }

            // Start next download
            dequeueDownload();
        };

        img.onerror = () => {
            activeDownloads--;
            reject(new Error(`Failed to load image at ${imageUrl}`));

            // Start next download
            dequeueDownload();
        };

        img.src = imageUrl; // Does the download
    });
}

function prioritizeNear(index) {

    requestedIndex = index;
    if (imageQueue.length > 0) {
        imageQueue = reprioritize(imageQueue, index);
        enqueueDownloads(imageQueue);
    }
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
