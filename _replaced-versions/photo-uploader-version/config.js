/* ==========================================================================
   Edit this file to personalise the site. It is plain JavaScript.
   ========================================================================== */

window.SITE_CONFIG = {
  /* Your portrait, shown on Home and About.
     1. Put the photo at assets/photos/portrait.jpg (JPG/PNG/WebP, about 1200 x 1500 px works well).
     2. Set the path below, e.g. portrait: "assets/photos/portrait.jpg"
     Until then a placeholder is shown, with an "Add photograph" button that stores a photo in
     this browser only (good for previewing; visitors will not see it). */
  portrait: "",

  /* Show the "Add photos" / "Add photograph" / remove tools?
     Keep true while you are building the site on your computer.
     Set to false before publishing, so visitors only see the published photos. */
  ownerTools: true
};

/* ==========================================================================
   Published gallery photos (visible to every visitor).
   1. Copy the image files into assets/gallery/
   2. Add one entry per photo below. Only "src" is required.
      "featured: true" shows that photo larger at the start of its activity.
   Example:
     { src: "assets/gallery/prometeo-stage.jpg", title: "Opening night", activity: "Prometeo 2026",
       date: "2026-03-14", caption: "Live multi-camera coverage with the media team.", featured: true },
   ========================================================================== */
window.GALLERY_PHOTOS = [
];
