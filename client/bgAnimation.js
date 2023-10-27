const bgcvs = document.getElementById("backgroundCanv");

bgcvs.width = window.innerWidth.toString();
bgcvs.height = window.innerHeight.toString();

window.onresize = function() {
  bgcvs.width = window.innerWidth.toString();
  bgcvs.height = window.innerHeight.toString();
};

let circles = [];
const colors = ["#FAFAFF", "#E4D9FF", "#AF2BBF", "#A14EBF"];

for (let i = 0; i < 300; i++) {
  circles.push({ x: Math.random() * (bgcvs.width / 3) - (bgcvs.width / 6), y: Math.random() * (bgcvs.height/3) - (bgcvs.height/6), c: colors[Math.floor(Math.random() * colors.length)], dir: (Math.random() * Math.PI * 2), vel: (Math.random() * 0.5 + 2), width: Math.random() * 30 + 10 });
}

const bgctx = bgcvs.getContext("2d");

setInterval(function() {
  bgctx.fillStyle = "#111234";
  bgctx.fillRect(0, 0, bgcvs.width, bgcvs.height);
  for (let i = 0; i < circles.length; i++) {
    //console.log(parseInt(Math.floor(((Math.abs(circles[i].x) + Math.abs(circles[i].y)) / bgcvs.width) * 256), 16));
    bgctx.fillStyle = circles[i].c + (Math.floor(((Math.abs(circles[i].x) + Math.abs(circles[i].y)) / bgcvs.width) * 256)).toString(16);
    bgctx.beginPath();
    bgctx.arc(circles[i].x + (bgcvs.width / 2), circles[i].y + (bgcvs.height / 2), circles[i].width, 0, Math.PI * 2);
    bgctx.fill();
    circles[i].x += Math.sin(circles[i].dir) * circles[i].vel;
    circles[i].y += Math.cos(circles[i].dir) * circles[i].vel;
    if (Math.abs(circles[i].x) > bgcvs.width) {
      circles[i].x = Math.random() * 100 - 50;
      circles[i].y = Math.random() * 100 - 50;
    }
  }
}, 10);