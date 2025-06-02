let flowfield;
let particles = [];
let audioContext;
let analyser;
let dataArray;
let audioInitialized = false;
let fallbackMode = false;
let audioLevel = 0;
let rotation = 0;
let stars = [];

// Define frequency ranges with even more extreme threshold adjustments 
const frequencyRanges = [
  // BASS GROUP - EXTREMELY HIGH thresholds (very insensitive)
  { name: "Sub Bass", min: 20, max: 40, color: [128, 0, 0], threshold: 0.2, group: "bass" },      // Dark Red
  { name: "Deep Bass", min: 40, max: 80, color: [255, 0, 0], threshold: 0.3, group: "bass" },     // Bright Red
  { name: "Bass", min: 80, max: 160, color: [255, 64, 0], threshold: 0.3, group: "bass" },        // Red-Orange
  { name: "Upper Bass", min: 160, max: 300, color: [255, 128, 0], threshold: 0.3, group: "bass" }, // Orange

  // MID GROUP - Moderate thresholds (unchanged)
  { name: "Low Mids", min: 300, max: 500, color: [255, 200, 0], threshold: 0.3, group: "mid" },   // Amber
  { name: "Mid-Low", min: 500, max: 800, color: [255, 255, 0], threshold: 0.28, group: "mid" },    // Yellow
  { name: "Mid", min: 800, max: 1200, color: [0, 255, 255], threshold: 0.15, group: "mid" },       // Yellow-Green
  { name: "Mid-High", min: 1200, max: 2000, color: [0, 255, 0], threshold: 0.2, group: "mid" },   // Green
  { name: "High Mids", min: 2000, max: 3000, color: [0, 255, 128], threshold: 0.1, group: "mid" }, // Blue-Green

  // HIGH GROUP - EXTREMELY LOW thresholds (ultra sensitive)
  { name: "Low Treble", min: 3000, max: 4000, color: [180, 255, 0], threshold: 0.2, group: "high" }, // Cyan
  { name: "Mid Treble", min: 4000, max: 6000, color: [0, 128, 255], threshold: 0.05, group: "high" }, // Light Blue
  { name: "Presence", min: 6000, max: 8000, color: [255, 255, 255], threshold: 0.05, group: "high" },  // Blue
  { name: "Brilliance", min: 8000, max: 12000, color: [128, 0, 255], threshold: 0.05, group: "high" }, // Purple
  { name: "Air", min: 12000, max: 20000, color: [255, 0, 255], threshold: 0.04, group: "high" }     // Magenta
];

// Display frequency range info
let showFrequencyLegend = true;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
 
  for (let i = 0; i < 100; i++) {
    stars+=[random(0,width),random(0,height),random(1,5)];
  }
  
  // Initialize flowfield
  flowfield = {
    scale: 20,
    cols: floor(width / 20),
    rows: floor(height / 20),
    field: [],
    zoff: 0
  };
  
  // Initialize flowfield vectors
  for (let i = 0; i < flowfield.cols * flowfield.rows; i++) {
    flowfield.field[i] = createVector(0, 0);
  }

  // Add text instructions
  textAlign(CENTER);
  fill(255);
  text("Click anywhere to start audio input", width/2, height/2);
}

function draw() {
  rotation += 0;
  background(0, 200); // Fade effect

  // Update flowfield based on noise
  updateFlowField();
  
  if (audioInitialized || fallbackMode) {
    // Analyze audio and get frequency data
    analyzeAudio();
    
    // Spawn particles based on audio energy
    spawnParticlesBasedOnFrequencies();
  }
  
  for(let star of stars) {
    fill(255,255,255,100);
    stroke(255,255,255,100);
    strokeWeight(1);
    circle(star[0],star[1],1);
    // console.log(stars[i][0],stars[i][1],stars[i][2]);
  }

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].follow(flowfield);
    particles[i].update();
    particles[i].edges();
    particles[i].show();
    
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
  
  // Display audio level indicator
  displayAudioLevelIndicator();
  
  // Display frequency legend if enabled
  if (showFrequencyLegend) {
    displayFrequencyLegend();
  }
  
  // Display instructions if audio not started
  if (!audioInitialized && !fallbackMode) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(18);
    text('Click anywhere to start audio input', width/2, height/2);
  }
}

function updateFlowField() {
  let yoff = 0;
  for (let y = 0; y < flowfield.rows; y++) {
    let xoff = 0;
    for (let x = 0; x < flowfield.cols; x++) {
      let index = x + y * flowfield.cols;
      let angle = noise(xoff, yoff, flowfield.zoff) * TWO_PI * 2;
      let v = p5.Vector.fromAngle(angle);
      v.setMag(0.5);
      flowfield.field[index] = v;
      xoff += 0.1;
    }
    yoff += 0.1;
  }
  flowfield.zoff += 0.01;
}

function analyzeAudio() {
  if (audioInitialized && analyser && dataArray) {
    // Get frequency data
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate overall audio level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    audioLevel = sum / (dataArray.length * 255); // Normalize to 0-1
    audioLevel = pow(audioLevel, 0.8); // Apply curve for better response
  } else if (fallbackMode) {
    // Simulate audio in fallback mode
    audioLevel = 0.3 + 0.3 * sin(frameCount * 0.05);
    // Add some random variation
    if (random(1) < 0.05) {
      audioLevel = random(0, 0.8);
    }
  }
}

function spawnParticlesBasedOnFrequencies() {
  // Find the single most dominant frequency across all ranges
  let dominantRange = null;
  let highestRelativeEnergy = 0;
  
  // Analyze all frequency ranges
  for (let i = 0; i < frequencyRanges.length; i++) {
    const range = frequencyRanges[i];
    const energy = getBandEnergy(range.min, range.max);
    
    // Store the current energy for visualization in the legend
    range.currentEnergy = energy;
    
    // Calculate relative energy (how much it exceeds its threshold)
    const relativeEnergy = energy / range.threshold;
    range.relativeEnergy = relativeEnergy;
    
    // Reset active state
    range.isActive = false;
    
    // Check if this is the most dominant frequency
    if (energy > range.threshold && relativeEnergy > highestRelativeEnergy) {
      highestRelativeEnergy = relativeEnergy;
      dominantRange = range;
    }
  }
  
  // Spawn particles only for the most dominant frequency range
  if (dominantRange) {
    // Set as active
    dominantRange.isActive = true;
    
    const energy = dominantRange.currentEnergy;
    
    // Calculate spawn count based on energy level
    // number of particles is based on the energy level
    let count = floor(map(energy, dominantRange.threshold, 1, 1, 60));
    
    // Spawn particles
    for (let j = 0; j < count; j++) {
      createColoredParticle(dominantRange, energy);
    }
  }
}

function createColoredParticle(range, energy) {
  // Calculate position along the x-axis based on the frequency range
  
  const rangeIndex = frequencyRanges.indexOf(range);
  // const xPos = map(rangeIndex, 0, frequencyRanges.length - 1, width * 0.1, width * 0.9);
  // const xVariation = width * 0.2; // Add some variation
  // const x = xPos + random(-xVariation, xVariation);
  // const y = random(height);
  const randvar = random(-1,1);
  const x = map(rotation%TWO_PI+randvar+rangeIndex,0,(frequencyRanges.length-1),0,.9*width);
  const y = .5*height+height*random(-.2,.2);
  
  // Create the particle
  const p = new Particle(x, y);
  
  // Set the color for this particle
  p.color = color(range.color[0], range.color[1], range.color[2]);
  
  // Adjust particle speed based on frequency group and energy
  if (range.group === "bass") {
    // Bass frequencies: need more energy to get faster
    p.maxSpeed = map(energy, range.threshold, 1, .1,4); 
  } else if (range.group === "high") {
    // High frequencies: get fast with less energy
    p.maxSpeed = map(energy, range.threshold, 0.5, .1, 4);
  } else {
    // Mid frequencies: normal scaling
    p.maxSpeed = map(energy, range.threshold, 1, 1, 4);
  }
  
  // Constrain speed to reasonable values
  p.maxSpeed = constrain(p.maxSpeed, 1.0, 16);
  
  // Add to particles array
  particles.push(p);
}

function getBandEnergy(minFreq, maxFreq) {
  if (!audioInitialized || !analyser || !dataArray) {
    // Return simulated values in fallback mode
    return 0.1 + 0.2 * sin(frameCount * 0.05 + minFreq * 0.001);
  }
  
  // Calculate the band energy from the FFT data
  const sampleRate = audioContext.sampleRate;
  const binCount = analyser.frequencyBinCount;
  const nyquist = sampleRate / 2;
  
  const minBin = Math.floor(minFreq / nyquist * binCount);
  const maxBin = Math.floor(maxFreq / nyquist * binCount);
  
  let sum = 0;
  let count = 0;
  
  for (let i = minBin; i <= maxBin; i++) {
    if (i >= 0 && i < binCount) {
      sum += dataArray[i];
      count++;
    }
  }
  
  // Return normalized energy (0-1)
  return count > 0 ? (sum / (count * 255)) : 0;
}

function displayAudioLevelIndicator() {
  // Draw audio level indicator in the top-right corner
  push();
  noStroke();
  fill(255, 100);
  const indicatorSize = map(audioLevel, 0, 1, 5, 20);
  ellipse(width - 20, 20, indicatorSize, indicatorSize);
  
  // Add text label
  textSize(10);
  textAlign(RIGHT);
  text("Audio Level", width - 30, 20);
  pop();
}

function displayFrequencyLegend() {
  // Show frequency range colors and current energy levels
  push();  

  const legendHeight = 40;
  const legendY = height - legendHeight - 10;
  const boxWidth = width / frequencyRanges.length;
  
  for (let i = 0; i < frequencyRanges.length; i++) {
    const range = frequencyRanges[i];
    const x = i * boxWidth + rotation%TWO_PI;
    
    // Draw background
    noStroke();
    fill(40, 255);
    
    // If this is the active range, highlight it
    if (range.isActive) {
      stroke(255);
      strokeWeight(2);
    } else {
      noStroke();
    }
    
    rect(x, legendY, boxWidth, legendHeight);
    
    // Draw color indicator
    noStroke();
    fill(range.color[0], range.color[1], range.color[2]);
    rect(x + 5, legendY + 5, boxWidth - 10, 10);
    
    // Draw text info
    fill(255);
    textAlign(CENTER);
    textSize(9);
    text(range.name, x + boxWidth/2, legendY + 25);
    
    // Draw frequency range
    textSize(8);
    text(range.min + "-" + range.max + "Hz", x + boxWidth/2, legendY + 35);
    
    // Draw energy level if available
    if (range.relativeEnergy !== undefined) {
      // Draw energy bar
      const barHeight = 5;
      const barWidth = (boxWidth - 10) * range.relativeEnergy;
      
      // Use yellow for normal energy bars, bright green for the active one
      fill(range.isActive ? color(100, 255, 100) : color(255, 255, 0));
      rect(x + 5, legendY + 15, barWidth, barHeight);
      
      // Draw threshold line
      stroke(255, 0, 0);
      let thresholdX = x + 5 + (boxWidth - 10) * range.threshold;
      line(thresholdX, legendY + 15, thresholdX, legendY + 15 + barHeight);
    }
  }
  
  pop();
}

function mousePressed() {
  if (!audioInitialized && !fallbackMode) {
    initializeAudio();
  }
  
  // Toggle legend display with right-click
  if (mouseButton === RIGHT) {
    showFrequencyLegend = !showFrequencyLegend;
    return false; // Prevent context menu
  }
}

function initializeAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    
    // Set FFT size for analysis
    analyser.fftSize = 2048; // Increased for better frequency resolution
    analyser.smoothingTimeConstant = 0.4;
    
    // Create data array for frequency analysis
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Get user's microphone
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(function(stream) {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        audioInitialized = true;
        console.log("Audio initialized successfully");
      })
      .catch(function(err) {
        console.error("Error initializing audio:", err);
        fallbackMode = true;
      });
  } catch (e) {
    console.error("AudioContext error:", e);
    fallbackMode = true;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
  
  // Reinitialize flowfield
  flowfield.cols = floor(width / flowfield.scale);
  flowfield.rows = floor(height / flowfield.scale);
  flowfield.field = [];
  
  for (let i = 0; i < flowfield.cols * flowfield.rows; i++) {
    flowfield.field[i] = createVector(0, 0);
  }
} 