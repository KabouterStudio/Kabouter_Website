
const images = [
  "images/Draaiproject/Zuigbuis.png",
  "images/Draaiproject/Draai.png",
  "images/Draaiproject/Koe.png",
  "images/Draaiproject/Koning.png",
  "images/Draaiproject/Werp.png",
  "images/Draaiproject/Ufo.png",
];


let currentIndex = 0;


function showImage(index) {
  const imgElement = document.getElementById("sliderImage");
  imgElement.src = images[index];
}

// Ga naar volgende afbeelding
function nextImage() {
  currentIndex = (currentIndex + 1) % images.length; 
  showImage(currentIndex);
}

// Ga naar vorige afbeelding
function prevImage() {
  currentIndex = (currentIndex - 1 + images.length) % images.length; 
  showImage(currentIndex);
}