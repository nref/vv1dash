let imageList = [];
let intervalId = null;
let maxIndex = 0;

// Load images from JSON file
fetch('assets/index.json')
    .then(response => response.json())
    .then(data => {
        imageList = data;
        maxIndex = imageList.length - 1;
        document.getElementById('photo-slider').max = maxIndex;
        prefetchImages(imageList).then(() => {
            console.log('All images prefetched!');
        }).catch(error => {
            console.error('Error prefetching images:', error);
        });
        updateImage(maxIndex); // Load the latest image initially (rightmost position)
        toggleButtons(); // Initially disable the pause button
    })
    .catch(error => console.error('Error loading the photos:', error));

// Event listener for slider change
document.getElementById('photo-slider').addEventListener('input', function() {
    updateImage(this.value);
});

// Previous and Next button functionality
document.getElementById('prev-button').addEventListener('click', function() {
    changeImage(-1);
});

document.getElementById('next-button').addEventListener('click', function() {
    changeImage(1);
});

// Play and Pause button functionality
document.getElementById('play-button').addEventListener('click', function() {
    playSlideShow();
});

document.getElementById('pause-button').addEventListener('click', function() {
    clearInterval(intervalId);
    intervalId = null;
    toggleButtons(); // Update button states when paused
});

// Speed selection change handling
document.getElementById('speed-select').addEventListener('change', function() {
    if (intervalId !== null) { // Restart playing with new speed if currently playing
        playSlideShow();
    }
});

function prefetchImages(images) {
    const promises = images.map(imageUrl => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image at ${imageUrl}`));
            img.src = `assets/${imageUrl}`;
        });
    });
    return Promise.all(promises);
}

function updateImage(index) {
    const photo = document.getElementById('photo');
    const slider = document.getElementById('photo-slider');
    const label = document.getElementById('slider-label');

    slider.value = index;
    photo.src = `assets/${imageList[index]}`;
    const i = parseInt(index) + parseInt(1);
    label.textContent = `${i} of ${imageList.length}`;
}
function changeImage(direction) {
    const slider = document.getElementById('photo-slider');
    const newValue = parseInt(slider.value) + direction;
    if (newValue >= 0 && newValue < imageList.length) {
        updateImage(newValue);
    }
}

// Function to start the slideshow
function playSlideShow() {
    const interval = parseInt(document.getElementById('speed-select').value);
    clearInterval(intervalId); // Clear existing interval to reset the speed
    const slider = document.getElementById('photo-slider');

    if (slider.value == maxIndex) {
        slider.value = 0;
    }

    intervalId = setInterval(() => {
        if (slider.value < imageList.length - 1) {
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
    console.log("playing: ", isPlaying)
    document.getElementById('play-button').disabled = isPlaying;
    document.getElementById('pause-button').disabled = !isPlaying;
}
