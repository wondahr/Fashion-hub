// ==================== GLOBAL VARIABLES ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let currentColor = 'black';
let brushSize = 5;
let strokes = [];
let currentStroke = null;
let isErasing = false;

let measureMode = false;
let measureStart = null;
let measurements = [];

let deleteMeasureMode = false;

let currentFabric = 'none';
let pattern = null;

let aiImageData = null;
let lastPrompt = '';
let lastStyle = 'professional fashion design sketch, clean lines';

let redoStack = [];
let shapeMode = 'freehand';
let shapeStart = null;
let gridVisible = false;

let textSelectMode = false;
let selectedTextIndex = -1;
let isDraggingText = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let shapeSelectMode = false;
let selectedShapeIndex = -1;
let isDraggingShape = false;
let isResizingShape = false;
let shapeDragOffsetX = 0;
let shapeDragOffsetY = 0;
let resizeHandle = null;

// ==================== TOUCH PREVENTION ====================
document.addEventListener('touchmove', function(e) {
    if (e.target === canvas || e.target.closest('.canvas-container')) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('dblclick', function(e) {
    e.preventDefault();
}, { passive: false });

document.addEventListener('contextmenu', function(e) {
    if (e.target === canvas) {
        e.preventDefault();
    }
});

// ==================== CANVAS SETUP ====================
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    redrawCanvas();
}

// ==================== FABRIC PATTERN ====================
function applyFabricPattern() {
    if (currentFabric === 'none') {
        pattern = null;
        return;
    }
    
    const pCanvas = document.createElement('canvas');
    const pCtx = pCanvas.getContext('2d');
    const size = 60;
    pCanvas.width = size;
    pCanvas.height = size;
    
    pCtx.fillStyle = 'white';
    pCtx.fillRect(0, 0, size, size);
    
    if (currentFabric === 'dots') {
        pCtx.fillStyle = '#ccc';
        pCtx.beginPath();
        pCtx.arc(size/2, size/2, 5, 0, Math.PI*2);
        pCtx.fill();
    } else if (currentFabric === 'stripes') {
        pCtx.fillStyle = '#ddd';
        pCtx.fillRect(0, 0, size/2, size);
    } else if (currentFabric === 'grid') {
        pCtx.strokeStyle = '#ccc';
        pCtx.lineWidth = 2;
        pCtx.beginPath();
        pCtx.moveTo(size/2, 0);
        pCtx.lineTo(size/2, size);
        pCtx.moveTo(0, size/2);
        pCtx.lineTo(size, size/2);
        pCtx.stroke();
    } else if (currentFabric === 'plaid') {
        pCtx.fillStyle = '#f0d0d0';
        pCtx.fillRect(0, 0, size, size);
        pCtx.fillStyle = '#c0a0a0';
        pCtx.fillRect(0, 0, size/4, size);
        pCtx.fillRect(size/2, 0, size/4, size);
        pCtx.fillStyle = '#a08080';
        pCtx.fillRect(0, 0, size, size/4);
        pCtx.fillRect(0, size/2, size, size/4);
    } else if (currentFabric === 'chevron') {
        pCtx.strokeStyle = '#bbb';
        pCtx.lineWidth = 3;
        pCtx.beginPath();
        for (let i = -size; i < size*2; i += 10) {
            pCtx.moveTo(i, 0);
            pCtx.lineTo(i + size/2, size/2);
            pCtx.lineTo(i + size, 0);
        }
        pCtx.stroke();
    } else if (currentFabric === 'herringbone') {
        pCtx.strokeStyle = '#aaa';
        pCtx.lineWidth = 2;
        const s = size/4;
        for (let y = 0; y < size; y += s) {
            for (let x = 0; x < size; x += s) {
                pCtx.beginPath();
                pCtx.moveTo(x, y + s);
                pCtx.lineTo(x + s/2, y);
                pCtx.lineTo(x + s, y + s);
                pCtx.stroke();
            }
        }
    } else if (currentFabric === 'lace') {
        pCtx.strokeStyle = '#ddd';
        pCtx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const cx = size/2 + Math.cos(i * 2 * Math.PI/3) * 15;
            const cy = size/2 + Math.sin(i * 2 * Math.PI/3) * 15;
            pCtx.beginPath();
            pCtx.arc(cx, cy, 8, 0, Math.PI*2);
            pCtx.stroke();
        }
        pCtx.beginPath();
        pCtx.arc(size/2, size/2, 5, 0, Math.PI*2);
        pCtx.stroke();
    }
    
    pattern = ctx.createPattern(pCanvas, 'repeat');
}

// ==================== REDRAW CANVAS (SIMPLIFIED) ====================
function redrawCanvas() {
    // Fill background
    if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw AI image
    if (aiImageData) {
        ctx.drawImage(
            aiImageData.img,
            aiImageData.x,
            aiImageData.y,
            aiImageData.width,
            aiImageData.height
        );
    }
    
    // Draw grid
    if (gridVisible) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    // Draw all strokes
    for (const stroke of strokes) {
        if (stroke.type === 'text') {
            ctx.font = `${stroke.size}px Arial`;
            ctx.fillStyle = stroke.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stroke.text, stroke.x, stroke.y);
            continue;
        }
        
        if (stroke.points.length < 2) continue;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        
        if (stroke.shape === 'line' && stroke.points.length >= 2) {
            ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
        } else if (stroke.shape === 'rectangle' && stroke.points.length >= 2) {
            const start = stroke.points[0];
            const end = stroke.points[stroke.points.length - 1];
            ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (stroke.shape === 'circle' && stroke.points.length >= 2) {
            const start = stroke.points[0];
            const end = stroke.points[stroke.points.length - 1];
            const radius = Math.sqrt((end.x - start.x)**2 + (end.y - start.y)**2);
            ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        } else {
            for (let j = 1; j < stroke.points.length; j++) {
                ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
            }
        }
        
        if (stroke.erase) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = stroke.color;
        }
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }
    
    // Draw current stroke in progress
    if (currentStroke && currentStroke.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
        for (let j = 1; j < currentStroke.length; j++) {
            ctx.lineTo(currentStroke[j].x, currentStroke[j].y);
        }
        ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : currentColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    
    // Draw measurements
    for (const m of measurements) {
        ctx.beginPath();
        ctx.moveTo(m.start.x, m.start.y);
        ctx.lineTo(m.end.x, m.end.y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const midX = (m.start.x + m.end.x) / 2;
        const midY = (m.start.y + m.end.y) / 2;
        ctx.fillStyle = 'red';
        ctx.font = '14px Arial';
        ctx.fillText(m.length + ' cm', midX, midY);
    }
}

// ==================== DRAWING ====================
function startDrawing(e) {
    if (measureMode || deleteMeasureMode || textSelectMode || shapeSelectMode) return;
    
    isDrawing = true;
    currentStroke = [];
    const pos = getPosition(e);
    currentStroke.push(pos);
}

function draw(e) {
    if (measureMode || deleteMeasureMode || textSelectMode || shapeSelectMode) return;
    
    e.preventDefault();
    if (!isDrawing) return;
    
    const pos = getPosition(e);
    currentStroke.push(pos);
    
    // Redraw canvas with current stroke
    redrawCanvas();
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentStroke && currentStroke.length > 0) {
        strokes.push({
            points: currentStroke,
            color: currentColor,
            size: brushSize,
            erase: isErasing,
            shape: shapeMode !== 'freehand' ? shapeMode : null
        });
        redoStack = [];
    }
    currentStroke = null;
    redrawCanvas();
}

function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    } else {
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
}

// ==================== EVENT LISTENERS ====================
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

// ==================== TOOL FUNCTIONS ====================
function changeColor(color) {
    currentColor = color;
    isErasing = false;
    document.getElementById('current-color-display').textContent = color;
    document.getElementById('status-color-dot').style.background = color;
    updateModeDisplay();
}

function handleColorInput(color) {
    changeColor(color);
}

function setEraser() {
    isErasing = true;
    updateModeDisplay();
}

function updateBrushSize(size) {
    brushSize = parseInt(size);
    document.getElementById('brush-size-label').textContent = brushSize;
    document.getElementById('status-brush-size').textContent = brushSize;
}

function clearCanvas() {
    strokes = [];
    measurements = [];
    currentStroke = null;
    aiImageData = null;
    redoStack = [];
    redrawCanvas();
}

function clearAI() {
    aiImageData = null;
    redrawCanvas();
}

function undoLast() {
    if (strokes.length > 0) {
        redoStack.push(strokes.pop());
        redrawCanvas();
    }
}

function redoLast() {
    if (redoStack.length > 0) {
        strokes.push(redoStack.pop());
        redrawCanvas();
    }
}

function setFabric(type) {
    currentFabric = type;
    applyFabricPattern();
    redrawCanvas();
}

function setShapeMode(mode) {
    shapeMode = mode;
    isErasing = false;
    updateModeDisplay();
}

function toggleGrid() {
    gridVisible = !gridVisible;
    redrawCanvas();
}

function updateModeDisplay() {
    const modeEl = document.getElementById('current-mode-display');
    if (measureMode) {
        modeEl.textContent = 'Measure';
    } else if (isErasing) {
        modeEl.textContent = 'Eraser';
    } else if (shapeMode === 'line') {
        modeEl.textContent = 'Line';
    } else if (shapeMode === 'rectangle') {
        modeEl.textContent = 'Rectangle';
    } else if (shapeMode === 'circle') {
        modeEl.textContent = 'Circle';
    } else {
        modeEl.textContent = 'Pen';
    }
}

// ==================== TEXT FUNCTIONS ====================
function addText() {
    const text = prompt('Enter text:');
    if (text) {
        strokes.push({
            type: 'text',
            text: text,
            x: canvas.width / 2,
            y: canvas.height / 2,
            color: currentColor,
            size: brushSize * 4
        });
        redrawCanvas();
    }
}

function toggleTextSelectMode() {
    textSelectMode = !textSelectMode;
    if (textSelectMode) {
        shapeMode = 'freehand';
        isErasing = false;
        document.getElementById('current-mode-display').textContent = 'Select Text';
    } else {
        updateModeDisplay();
    }
}

// ==================== MEASURE ====================
function toggleMeasureMode() {
    measureMode = !measureMode;
    if (measureMode) {
        isDrawing = false;
        isErasing = false;
    }
    updateModeDisplay();
}

canvas.addEventListener('click', (e) => {
    if (measureMode) {
        const pos = getPosition(e);
        if (!measureStart) {
            measureStart = pos;
        } else {
            const end = pos;
            const dist = Math.sqrt((end.x - measureStart.x)**2 + (end.y - measureStart.y)**2);
            const lengthCm = (dist * 0.026).toFixed(1);
            measurements.push({
                start: measureStart,
                end: end,
                length: lengthCm
            });
            measureStart = null;
            redrawCanvas();
        }
    }
});

function toggleDeleteMeasureMode() {
    deleteMeasureMode = !deleteMeasureMode;
    if (deleteMeasureMode) {
        measureMode = false;
    }
    updateModeDisplay();
}

// ==================== TOGGLE PANELS ====================
function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

function toggleColorsPanel() {
    const panel = document.getElementById('colors-panel');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

// ==================== AI DESIGN ====================
function showAIPanel() {
    document.getElementById('ai-panel').style.display = 'flex';
}

function hideAIPanel() {
    document.getElementById('ai-panel').style.display = 'none';
}

async function createAIDesign() {
    const prompt = document.getElementById('prompt').value;
    if (!prompt) {
        alert('Please describe your dress first!');
        return;
    }
    const style = document.getElementById('style-select').value;
    lastPrompt = prompt;
    lastStyle = style;
    hideAIPanel();
    await generateAI(prompt, style);
}

async function generateAgain() {
    if (!lastPrompt) {
        alert('Generate a design first!');
        return;
    }
    await generateAI(lastPrompt, lastStyle);
}

async function generateAI(prompt, style) {
    try {
        const fullPrompt = `${prompt}, ${style}`;
        const safePrompt = encodeURIComponent(fullPrompt);
        const seed = Math.floor(Math.random() * 100000);
        const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=512&height=768&nologo=true&seed=${seed}`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            const imgWidth = Math.min(canvas.width - 40, 400);
            const imgHeight = imgWidth * 1.5;
            const x = (canvas.width - imgWidth) / 2;
            const y = (canvas.height - imgHeight) / 2;
            aiImageData = { img, x, y, width: imgWidth, height: imgHeight };
            strokes = [];
            measurements = [];
            redrawCanvas();
        };
        img.src = imageUrl;
    } catch (error) {
        alert('Error connecting to AI.');
    }
}

// ==================== SAVE & SHARE ====================
function saveDesign() {
    const link = document.createElement('a');
    link.download = 'fashion-design.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function shareDesign() {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'fashion-design.png', { type: 'image/png' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'My Fashion Design',
                text: 'Check out my new design!',
            });
        } catch (err) {
            console.log('Share cancelled');
        }
    } else {
        saveDesign();
    }
}

// ==================== INITIALIZE ====================
window.addEventListener('load', () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    updateBrushSize(5);
    changeColor('black');
    updateModeDisplay();
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('colors-panel').style.display = 'none';
    document.getElementById('custom-color').value = '#000000';
});
