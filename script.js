// ==================== GLOBAL VARIABLES ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const strokesCanvas = document.createElement('canvas');
const strokesCtx = strokesCanvas.getContext('2d');

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

// ==================== CANVAS SETUP ====================
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    strokesCanvas.width = canvas.width;
    strokesCanvas.height = canvas.height;
    clearStrokesCanvas();
    redrawCanvas();
}

function clearStrokesCanvas() {
    strokesCtx.clearRect(0, 0, strokesCanvas.width, strokesCanvas.height);
}

// ==================== FABRIC PATTERN ====================
function applyFabricPattern() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (currentFabric === 'none') {
        pattern = null;
        return;
    }
    
    const pCanvas = document.createElement('canvas');
    const pCtx = pCanvas.getContext('2d');
    const size = 60;
    pCanvas.width = size;
    pCanvas.height = size;
    
    function drawTile() {
        pCtx.fillStyle = 'white';
        pCtx.fillRect(0, 0, size, size);
        
        switch(currentFabric) {
            case 'dots':
                pCtx.fillStyle = '#ccc';
                pCtx.beginPath();
                pCtx.arc(size/2, size/2, 5, 0, Math.PI*2);
                pCtx.fill();
                break;
            case 'stripes':
                pCtx.fillStyle = '#ddd';
                pCtx.fillRect(0, 0, size/2, size);
                break;
            case 'grid':
                pCtx.strokeStyle = '#ccc';
                pCtx.lineWidth = 2;
                pCtx.beginPath();
                pCtx.moveTo(size/2, 0);
                pCtx.lineTo(size/2, size);
                pCtx.moveTo(0, size/2);
                pCtx.lineTo(size, size/2);
                pCtx.stroke();
                break;
            case 'plaid':
                pCtx.fillStyle = '#f0d0d0';
                pCtx.fillRect(0, 0, size, size);
                pCtx.fillStyle = '#c0a0a0';
                pCtx.fillRect(0, 0, size/4, size);
                pCtx.fillRect(size/2, 0, size/4, size);
                pCtx.fillStyle = '#a08080';
                pCtx.fillRect(0, 0, size, size/4);
                pCtx.fillRect(0, size/2, size, size/4);
                break;
            case 'chevron':
                pCtx.strokeStyle = '#bbb';
                pCtx.lineWidth = 3;
                pCtx.beginPath();
                for (let i = -size; i < size*2; i += 10) {
                    pCtx.moveTo(i, 0);
                    pCtx.lineTo(i + size/2, size/2);
                    pCtx.lineTo(i + size, 0);
                }
                pCtx.stroke();
                break;
            case 'herringbone':
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
                break;
            case 'lace':
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
                break;
        }
    }
    
    drawTile();
    pattern = ctx.createPattern(pCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ==================== COMPOSITE ====================
function redrawCanvas() {
    if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    if (aiImageData) {
        ctx.drawImage(
            aiImageData.img,
            aiImageData.x,
            aiImageData.y,
            aiImageData.width,
            aiImageData.height
        );
    }
    
    ctx.drawImage(strokesCanvas, 0, 0);
    
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

// ==================== DRAWING EVENTS ====================
function startDrawing(e) {
    if (measureMode || deleteMeasureMode) return;
    isDrawing = true;
    currentStroke = [];
    const pos = getPosition(e);
    currentStroke.push(pos);
}

function draw(e) {
    if (measureMode || deleteMeasureMode) return;
    e.preventDefault();
    if (!isDrawing) return;
    
    const pos = getPosition(e);
    currentStroke.push(pos);
    
    const last = currentStroke[currentStroke.length - 2];
    const curr = currentStroke[currentStroke.length - 1];
    
    strokesCtx.beginPath();
    strokesCtx.moveTo(last.x, last.y);
    strokesCtx.lineTo(curr.x, curr.y);
    
    if (isErasing) {
        strokesCtx.globalCompositeOperation = 'destination-out';
        strokesCtx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        strokesCtx.globalCompositeOperation = 'source-over';
        strokesCtx.strokeStyle = currentColor;
    }
    strokesCtx.lineWidth = brushSize;
    strokesCtx.lineCap = 'round';
    strokesCtx.lineJoin = 'round';
    strokesCtx.stroke();
    strokesCtx.globalCompositeOperation = 'source-over';
    
    redrawCanvas();
}

function stopDrawing() {
    if (measureMode || deleteMeasureMode) return;
    if (!isDrawing) return;
    isDrawing = false;
    if (currentStroke && currentStroke.length > 0) {
        strokes.push({
            points: currentStroke,
            color: currentColor,
            size: brushSize,
            erase: isErasing
        });
    }
    currentStroke = null;
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

canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

// ==================== CLICK HANDLER (for measure/delete measure) ====================
canvas.addEventListener('click', (e) => {
    if (deleteMeasureMode) {
        const pos = getPosition(e);
        deleteMeasurementAt(pos);
        return;
    }
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

function deleteMeasurementAt(pos) {
    const threshold = 15;
    for (let i = measurements.length - 1; i >= 0; i--) {
        const m = measurements[i];
        const dist = distanceToSegment(pos, m.start, m.end);
        if (dist < threshold) {
            measurements.splice(i, 1);
            redrawCanvas();
            return;
        }
    }
}

function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx*dx + dy*dy;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
}

// ==================== MODE TOGGLES ====================
function toggleMeasureMode() {
    measureMode = !measureMode;
    if (measureMode) {
        deleteMeasureMode = false;
        canvas.classList.add('measure-mode');
        isDrawing = false;
        isErasing = false;
    } else {
        canvas.classList.remove('measure-mode');
        measureStart = null;
    }
    updateModeDisplay();
}

function toggleDeleteMeasureMode() {
    deleteMeasureMode = !deleteMeasureMode;
    if (deleteMeasureMode) {
        measureMode = false;
        canvas.classList.add('measure-mode');
        isDrawing = false;
        isErasing = false;
    } else {
        canvas.classList.remove('measure-mode');
    }
    updateModeDisplay();
}

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
    measureStart = null;
    aiImageData = null;
    clearStrokesCanvas();
    redrawCanvas();
}

function clearAI() {
    aiImageData = null;
    redrawCanvas();
}

function undoLast() {
    if (strokes.length > 0) {
        strokes.pop();
        clearStrokesCanvas();
        for (const stroke of strokes) {
            if (stroke.points.length < 2) continue;
            strokesCtx.beginPath();
            strokesCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                strokesCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            strokesCtx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
            strokesCtx.strokeStyle = stroke.erase ? 'rgba(0,0,0,1)' : stroke.color;
            strokesCtx.lineWidth = stroke.size;
            strokesCtx.lineCap = 'round';
            strokesCtx.lineJoin = 'round';
            strokesCtx.stroke();
            strokesCtx.globalCompositeOperation = 'source-over';
        }
        redrawCanvas();
    }
}

function setFabric(type) {
    currentFabric = type;
    applyFabricPattern();
    redrawCanvas();
}

function updateModeDisplay() {
    const modeEl = document.getElementById('current-mode-display');
    if (deleteMeasureMode) {
        modeEl.textContent = 'Delete Measure';
    } else if (measureMode) {
        modeEl.textContent = 'Measure';
    } else if (isErasing) {
        modeEl.textContent = 'Eraser';
    } else {
        modeEl.textContent = 'Pen';
    }
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

function toggleColorsPanel() {
    const panel = document.getElementById('colors-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

// ==================== AI DESIGN ====================
function showAIPanel() {
    document.getElementById('ai-panel').style.display = 'flex';
    document.getElementById('prompt').focus();
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
    redrawCanvas();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('✨ AI is designing...', canvas.width/2, canvas.height/2);
    
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
            clearStrokesCanvas();
            redrawCanvas();
        };
        img.onerror = function() {
            alert('Could not generate AI image. Please try again.');
            redrawCanvas();
        };
        img.src = imageUrl;
    } catch (error) {
        alert('Error connecting to AI.');
        redrawCanvas();
    }
}

// ==================== SAVE & SHARE (with watermark) ====================
function getCanvasWithWatermark() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(canvas, 0, 0);

    const watermarkToggle = document.getElementById('watermark-toggle');
    if (watermarkToggle && watermarkToggle.checked) {
        const text = document.getElementById('watermark-text').value.trim();
        if (text) {
            const fontSize = Math.max(20, canvas.width * 0.04);
            tempCtx.font = `bold ${fontSize}px Arial, sans-serif`;
            tempCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            tempCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            tempCtx.lineWidth = 2;
            tempCtx.textAlign = 'right';
            tempCtx.textBaseline = 'bottom';

            const padding = 20;
            const x = tempCanvas.width - padding;
            const y = tempCanvas.height - padding;

            tempCtx.strokeText(text, x, y);
            tempCtx.fillText(text, x, y);
        }
    }
    return tempCanvas;
}

function saveDesign() {
    const exportCanvas = getCanvasWithWatermark();
    const link = document.createElement('a');
    link.download = 'fashion-design.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

async function shareDesign() {
    const exportCanvas = getCanvasWithWatermark();
    const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'fashion-design.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'My Fashion Design',
                text: 'Check out my new design!',
            });
        } catch (err) {
            console.log('Share cancelled', err);
        }
    } else {
        const link = document.createElement('a');
        link.download = 'fashion-design.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        alert('Sharing not supported, watermarked image saved instead.');
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
