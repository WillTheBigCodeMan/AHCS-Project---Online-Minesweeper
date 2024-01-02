const bgcvs = document.getElementById("backgroundCanv");

bgcvs.width = window.innerWidth.toString();
bgcvs.height = window.innerHeight.toString();

window.onresize = function() {
  bgcvs.width = window.innerWidth.toString();
  bgcvs.height = window.innerHeight.toString();
};

let circles = [];
const colors = ["#FAFAFF", "#E4D9FF", "#AF2BBF", "#A14EBF"];

for (let i = 0; i < 50; i++) {
  circles.push({baseColour:"", x: Math.random() * (bgcvs.width) - (bgcvs.width / 2), y: Math.random() * (bgcvs.height) - (bgcvs.height/2), c: colors[Math.floor(Math.random() * colors.length)], vel:{x:Math.random()*4 - 2, y:Math.random()*4 - 2}, cooldown:20, width: Math.random() * 20 + 20});
  circles[i].baseColour = circles[i].c;
}

const bgctx = bgcvs.getContext("2d");

setInterval(function() {
  bgctx.fillStyle = "#111234";
  bgctx.fillRect(0, 0, bgcvs.width, bgcvs.height);
  for (let i = 0; i < circles.length; i++) {
    if(circles[i].c != circles[i].baseColour){
      let redC = parseInt(circles[i].c[1] + circles[i].c[2], 16);
      let redT = parseInt(circles[i].baseColour[1] + circles[i].baseColour[2], 16);
      let x = Math.random();
      if(redC!= redT&&x < 0.8){
        redC -= ((redC - redT) / Math.abs(redC - redT));
      } 
      let blueC = parseInt(circles[i].c[5] + circles[i].c[6], 16);
      let blueT = parseInt(circles[i].baseColour[5] + circles[i].baseColour[6], 16);
      if(blueC!=blueT&&x< 0.8){
        blueC -= ((blueC - blueT) / Math.abs(blueC - blueT));
      }
      let greenC = parseInt(circles[i].c[3] + circles[i].c[4], 16);
      let greenT = parseInt(circles[i].baseColour[3] + circles[i].baseColour[4], 16);
      if(greenC!=greenT&&x < 0.8){
       greenC -= ((greenC - greenT) / Math.abs(greenC - greenT));
      }
      let newC = "#" + redC.toString(16) + greenC.toString(16) + blueC.toString(16);
      circles[i].c = newC;
    }
    bgctx.fillStyle = circles[i].c;
    bgctx.beginPath();
    bgctx.arc(circles[i].x + (bgcvs.width / 2), circles[i].y + (bgcvs.height / 2), circles[i].width, 0, Math.PI * 2);
    bgctx.fill();
    circles[i].x += circles[i].vel.x;
    circles[i].y += circles[i].vel.y;
    if(Math.abs(circles[i].x) >= bgcvs.width/2 + 50){
      circles[i].x = (bgcvs.width/2 + 50) * (circles[i].x > 0 ? -1 : 1);
    }
    if(Math.abs(circles[i].y) >= bgcvs.width/2 + 50){
      circles[i].y = (bgcvs.height/2 + 50) * (circles[i].y > 0 ? -1 : 1);
    }
    circles[i].cooldown--;
    for(let j = 0; j < circles.length; j++){
      if(circles[i].cooldown<0&&circles[j].cooldown<0&&j!==i&&Math.sqrt(Math.pow(circles[i].x - circles[j].x, 2) + Math.pow(circles[i].y - circles[j].y, 2)) <circles[i].width + circles[j].width){
        let m = (circles[j].y - circles[i].y) / (circles[j].x-circles[i].x);
        let theta = Math.atan(m);
        let v = {y:Math.sin(theta), x:Math.cos(theta)};
        //console.log(m, theta, v);
        if(circles[i].x > circles[j].x){
          circles[i].x = circles[j].x + Math.abs(v.x * (circles[i].width + circles[j].width));
        } else {
          circles[i].x = circles[j].x - Math.abs(v.x * (circles[i].width + circles[j].width));
        }
        if(circles[i].y > circles[j].y){
          circles[i].y = circles[j].y + Math.abs(v.y * (circles[i].width + circles[j].width));
        } else {
          circles[i].y = circles[j].y - Math.abs(v.y * (circles[i].width + circles[j].width));
        }
        let totalMomX = circles[i].vel.x * mass(circles[i]) + circles[j].vel.x * mass(circles[j]);
        let totalMomY = circles[i].vel.y * mass(circles[i]) + circles[j].vel.y * mass(circles[j]);
        
        circles[i].vel.x = circles[j].vel.x * mass(circles[j]) / mass(circles[i]);
        circles[i].vel.y = circles[j].vel.y * mass(circles[j]) / mass(circles[i]);

        circles[j].vel.x = (totalMomX - (circles[i].vel.x * mass(circles[i]))) / mass(circles[j]);
        circles[j].vel.y = (totalMomY - (circles[i].vel.y * mass(circles[i]))) / mass(circles[j]); 
        
        circles[i].c = "#574bd6";
        circles[j].c = "#574bd6";
      }
    }
  }
}, 10);

function mass(circle){
  return circle.width*circle.width * Math.PI;
}