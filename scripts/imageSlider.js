
const imageLibraries = {
  Draaiproject: [
    "images/Draaiproject/Zuigbuis.png",
    "images/Draaiproject/Draai.png",
    "images/Draaiproject/Koe.png",
    "images/Draaiproject/Koning.png",
    "images/Draaiproject/Werp.png",
    "images/Draaiproject/Ufo.png"
  ],
  WishieWashie: [
    "images/WishieWashie/Afbeelding01.png",
    "images/WishieWashie/Afbeelding02.png",
    "images/WishieWashie/Afbeelding03.png",
    "images/WishieWashie/Afbeelding04.png"
  ],
  Piss: [
    "images/Piss/pic2.png",
    "images/Piss/pic1.png",
  ]


};

// ✅ Slider class per project/instantie
class ImageSlider {
  constructor(projectKey, containerId) {
    this.images = imageLibraries[projectKey];
    this.index = 0;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`Container met ID '${containerId}' niet gevonden.`);
      return;
    }

    this.imgElement = this.container.querySelector(".sliderImage");
    this.leftArrow = this.container.querySelector(".left");
    this.rightArrow = this.container.querySelector(".right");

    // Event listeners
    this.leftArrow.addEventListener("click", () => this.prevImage());
    this.rightArrow.addEventListener("click", () => this.nextImage());

    // Toon eerste afbeelding
    this.showImage();
  }

  showImage() {
    if (this.imgElement && this.images.length > 0) {
      this.imgElement.src = this.images[this.index];
    }
  }

  nextImage() {
    this.index = (this.index + 1) % this.images.length;
    this.showImage();
  }

  prevImage() {
    this.index = (this.index - 1 + this.images.length) % this.images.length;
    this.showImage();
  }
}


window.addEventListener("DOMContentLoaded", () => {
  new ImageSlider("Draaiproject", "draaiSlider");
  new ImageSlider("WishieWashie", "wishieSlider");
  new ImageSlider("Piss", "PissSlider");
});