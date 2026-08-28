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

// ==================== REDRAW CANVAS ====================
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
    
    // Draw grid if visible
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
    
    // Draw strokes
    for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        
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
    
    // Draw selection highlight for selected text
    if (textSelectMode && selectedTextIndex >= 0 && strokes[selectedTextIndex]) {
        const textElement = strokes[selectedTextIndex];
        ctx.font = `${textElement.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textWidth = ctx.measureText(textElement.text).width;
        
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            textElement.x - textWidth/2 - 10,
            textElement.y - textElement.size/2 - 10,
            textWidth + 20,
            textElement.size + 20
        );
        ctx.setLineDash([]);
    }
    
    // Draw selection highlight for selected shape
    if (shapeSelectMode && selectedShapeIndex >= 0 && strokes[selectedShapeIndex]) {
        const shape = strokes[selectedShapeIndex];
        if (shape.points && shape.points.length >= 2) {
            const start = shape.points[0];
            const end = shape.points[shape.points.length - 1];
            
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            
            ctx.strokeStyle = '#6c5ce7';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#6c5ce7';
            ctx.beginPath();
            ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
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

// ==================== SHAPE MANIPULATION ====================
function toggleShapeSelectMode() {
    shapeSelectMode = !shapeSelectMode;
    if (shapeSelectMode) {
        textSelectMode = false;
        shapeMode = 'freehand';
        isErasing = false;
        document.getElementById('current-mode-display').textContent = 'Select Shape';
    } else {
        selectedShapeIndex = -1;
        updateModeDisplay();
    }
    redrawCanvas();
}

function getShapeAtPosition(pos) {
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        if (stroke.type === 'text' || !stroke.shape) continue;
        
        const points = stroke.points;
        if (points.length < 2) continue;
        
        const start = points[0];
        const end = points[points.length - 1];
        
        if (isPointNearShape(pos, start, end, stroke.shape)) {
            return i;
        }
    }
    return -1;
}

function isPointNearShape(pos, start, end, shapeType) {
    const threshold = 15;
    
    if (shapeType === 'line') {
        return distanceToSegment(pos, start, end) < threshold;
    } else if (shapeType === 'rectangle') {
        const minX = Math.min(start.x, end.x) - threshold;
        const maxX = Math.max(start.x, end.x) + threshold;
        const minY = Math.min(start.y, end.y) - threshold;
        const maxY = Math.max(start.y, end.y) + threshold;
        
        if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) return false;
        
        const nearLeft = Math.abs(pos.x - Math.min(start.x, end.x)) < threshold;
        const nearRight = Math.abs(pos.x - Math.max(start.x, end.x)) < threshold;
        const nearTop = Math.abs(pos.y - Math.min(start.y, end.y)) < threshold;
        const nearBottom = Math.abs(pos.y - Math.max(start.y, end.y)) < threshold;
        
        return nearLeft || nearRight || nearTop || nearBottom;
    } else if (shapeType === 'circle') {
        const radius = Math.sqrt((end.x - start.x)**2 + (end.y - start.y)**2);
        const distFromCenter = Math.sqrt((pos.x - start.x)**2 + (pos.y - start.y)**2);
        return Math.abs(distFromCenter - radius) < threshold;
    }
    return false;
}

function showShapeOptions(index) {
    const shape = strokes[index];
    const shapeNames = {
        'line': 'Line',
        'rectangle': 'Rectangle',
        'circle': 'Circle'
    };
    
    const action = prompt(
        `Selected ${shapeNames[shape.shape] || 'Shape'}\n\n` +
        'Choose action:\n' +
        '1. Move (drag shape)\n' +
        '2. Resize (drag endpoints)\n' +
        '3. Delete shape\n' +
        '4. Cancel\n\n' +
        'Type 1, 2, 3, or 4:'
    );
    
    if (action === '1') {
        selectedShapeIndex = index;
        isDraggingShape = false;
        isResizingShape = false;
        alert('Now tap and drag the shape to move it.');
    } else if (action === '2') {
        selectedShapeIndex = index;
        isDraggingShape = false;
        isResizingShape = true;
        alert('Now tap and drag to resize the shape.');
    } else if (action === '3') {
        strokes.splice(index, 1);
        selectedShapeIndex = -1;
        redrawCanvas();
    }
}

function startShapeDrag(e) {
    if (shapeSelectMode) {
        const pos = getPosition(e);
        const shapeIndex = getShapeAtPosition(pos);
        
        if (shapeIndex >= 0) {
            selectedShapeIndex = shapeIndex;
            const shape = strokes[shapeIndex];
            
            if (shape.points && shape.points.length >= 2) {
                const start = shape.points[0];
                const end = shape.points[shape.points.length - 1];
                
                if (Math.hypot(pos.x - start.x, pos.y - start.y) < 15) {
                    isResizingShape = true;
                    resizeHandle = 'start';
                } else if (Math.hypot(pos.x - end.x, pos.y - end.y) < 15) {
                    isResizingShape = true;
                    resizeHandle = 'end';
                } else {
                    isDraggingShape = true;
                    const centerX = (start.x + end.x) / 2;
                    const centerY = (start.y + end.y) / 2;
                    shapeDragOffsetX = pos.x - centerX;
                    shapeDragOffsetY = pos.y - centerY;
                }
            }
            redrawCanvas();
            return;
        } else {
            selectedShapeIndex = -1;
            redrawCanvas();
            return;
        }
    }
    
    startTextDrag(e);
}

function dragShape(e) {
    if (shapeSelectMode && selectedShapeIndex >= 0) {
        e.preventDefault();
        const pos = getPosition(e);
        const shape = strokes[selectedShapeIndex];
        
        if (isResizingShape && shape.points && shape.points.length >= 2) {
            if (resizeHandle === 'start') {
                shape.points[0] = pos;
            } else if (resizeHandle === 'end') {
                shape.points[shape.points.length - 1] = pos;
            }
            redrawCanvas();
            return;
        } else if (isDraggingShape && shape.points && shape.points.length >= 2) {
            const start = shape.points[0];
            const end = shape.points[shape.points.length - 1];
            const currentCenterX = (start.x + end.x) / 2;
            const currentCenterY = (start.y + end.y) / 2;
            
            const newCenterX = pos.x - shapeDragOffsetX;
            const newCenterY = pos.y - shapeDragOffsetY;
            
            const deltaX = newCenterX - currentCenterX;
            const deltaY = newCenterY - currentCenterY;
            
            for (let i = 0; i < shape.points.length; i++) {
                shape.points[i].x += deltaX;
                shape.points[i].y += deltaY;
            }
            
            redrawCanvas();
            return;
        }
    }
    
    dragText(e);
}

function stopShapeDrag() {
    if (isDraggingShape || isResizingShape) {
        isDraggingShape = false;
        isResizingShape = false;
        resizeHandle = null;
    }
    stopTextDrag();
}

// ==================== DRAWING FUNCTIONS ====================
function startTextDrag(e) {
    if (textSelectMode) {
        const pos = getPosition(e);
        const textIndex = getTextAtPosition(pos);
        
        if (textIndex >= 0) {
            selectedTextIndex = textIndex;
            isDraggingText = true;
            const textElement = strokes[textIndex];
            dragOffsetX = pos.x - textElement.x;
            dragOffsetY = pos.y - textElement.y;
            redrawCanvas();
            return;
        } else {
            selectedTextIndex = -1;
            redrawCanvas();
            return;
        }
    }
    
    if (measureMode || deleteMeasureMode) return;
    isDrawing = true;
    currentStroke = [];
    const pos = getPosition(e);
    
    if (shapeMode === 'freehand') {
        currentStroke.push(pos);
    } else {
        shapeStart = pos;
        currentStroke.push(pos);
    }
}

function dragText(e) {
    if (textSelectMode && isDraggingText && selectedTextIndex >= 0) {
        e.preventDefault();
        const pos = getPosition(e);
        const textElement = strokes[selectedTextIndex];
        textElement.x = pos.x - dragOffsetX;
        textElement.y = pos.y - dragOffsetY;
        redrawCanvas();
        return;
    }
    
    if (measureMode || deleteMeasureMode) return;
    e.preventDefault();
    if (!isDrawing) return;
    
    const pos = getPosition(e);
    
    if (shapeMode === 'freehand') {
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
    } else {
        redrawCanvas();
        drawShapePreview(pos);
    }
}

function stopTextDrag() {
    if (isDraggingText) {
        isDraggingText = false;
    }
    if (measureMode || deleteMeasureMode) return;
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
    shapeStart = null;
}

function drawShapePreview(pos) {
    if (!shapeStart) return;
    
    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    
    if (shapeMode === 'line') {
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(pos.x, pos.y);
    } else if (shapeMode === 'rectangle') {
        ctx.rect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y);
    } else if (shapeMode === 'circle') {
        const radius = Math.sqrt((pos.x - shapeStart.x)**2 + (pos.y - shapeStart.y)**2);
        ctx.beginPath();
        ctx.arc(shapeStart.x, shapeStart.y, radius, 0, Math.PI * 2);
    }
    ctx.stroke();
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

// ==================== TEXT FUNCTIONS ====================
function addText() {
    const text = prompt('Enter text:');
    if (text) {
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        strokes.push({
            type: 'text',
            text: text,
            x: x,
            y: y,
            color: currentColor,
            size: brushSize * 4
        });
        
        redrawCanvas();
    }
}

function toggleTextSelectMode() {
    textSelectMode = !textSelectMode;
    if (textSelectMode) {
        shapeSelectMode = false;
        shapeMode = 'freehand';
        isErasing = false;
        document.getElementById('current-mode-display').textContent = 'Select Text';
    } else {
        selectedTextIndex = -1;
        updateModeDisplay();
    }
    redrawCanvas();
}

function getTextAtPosition(pos) {
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        if (stroke.type === 'text') {
            ctx.font = `${stroke.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(stroke.text).width;
            const textHeight = stroke.size;
            
            if (pos.x >= stroke.x - textWidth/2 && 
                pos.x <= stroke.x + textWidth/2 &&
                pos.y >= stroke.y - textHeight/2 && 
                pos.y <= stroke.y + textHeight/2) {
                return i;
            }
        }
    }
    return -1;
}

function editText(index) {
    const textElement = strokes[index];
    const newText = prompt('Edit text:', textElement.text);
    if (newText !== null && newText.trim() !== '') {
        textElement.text = newText;
        redrawCanvas();
    }
}

function deleteText(index) {
    strokes.splice(index, 1);
    selectedTextIndex = -1;
    redrawCanvas();
}

function showTextOptions(index) {
    const textElement = strokes[index];
    const action = prompt(
        `Selected text: "${textElement.text}"\n\n` +
        'Choose action:\n' +
        '1. Move (drag text)\n' +
        '2. Edit text\n' +
        '3. Delete text\n' +
        '4. Cancel\n\n' +
        'Type 1, 2, 3, or 4:'
    );
    
    if (action === '1') {
        selectedTextIndex = index;
        isDraggingText = false;
        alert('Now tap and drag the text to move it.');
    } else if (action === '2') {
        editText(index);
    } else if (action === '3') {
        deleteText(index);
    }
}

// ==================== CLICK HANDLER ====================
canvas.addEventListener('click', (e) => {
    if (shapeSelectMode) {
        const pos = getPosition(e);
        const shapeIndex = getShapeAtPosition(pos);
        if (shapeIndex >= 0) {
            selectedShapeIndex = shapeIndex;
            showShapeOptions(shapeIndex);
        }
    }
    if (textSelectMode) {
        const pos = getPosition(e);
        const textIndex = getTextAtPosition(pos);
        if (textIndex >= 0) {
            selectedTextIndex = textIndex;
            showTextOptions(textIndex);
        }
    }
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

// ==================== EVENT LISTENERS ====================
canvas.addEventListener('touchstart', startShapeDrag);
canvas.addEventListener('touchmove', dragShape);
canvas.addEventListener('touchend', stopShapeDrag);
canvas.addEventListener('mousedown', startShapeDrag);
canvas.addEventListener('mousemove', dragShape);
canvas.addEventListener('mouseup', stopShapeDrag);
canvas.addEventListener('mouseleave', stopShapeDrag);

// ==================== MODE TOGGLES ====================
function toggleMeasureMode() {
    measureMode = !measureMode;
    if (measureMode) {
        deleteMeasureMode = false;
        textSelectMode = false;
        shapeSelectMode = false;
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
        textSelectMode = false;
        shapeSelectMode = false;
        canvas.classList.add('measure-mode');
        isDrawing = false;
        isErasing = false;
    } else {
        canvas.classList.remove('measure-mode');
    }
    updateModeDisplay();
}

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
    redoStack = [];
    selectedTextIndex = -1;
    selectedShapeIndex = -1;
    clearStrokesCanvas();
    redrawCanvas();
}

function clearAI() {
    aiImageData = null;
    redrawCanvas();
}

function undoLast() {
    if (strokes.length > 0) {
        const stroke = strokes.pop();
        redoStack.push(stroke);
        redrawCanvas();
    }
}

function redoLast() {
    if (redoStack.length > 0) {
        const stroke = redoStack.pop();
        strokes.push(stroke);
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
    textSelectMode = false;
    shapeSelectMode = false;
    selectedTextIndex = -1;
    selectedShapeIndex = -1;
    if (mode === 'freehand') {
        updateModeDisplay();
    } else {
        const shapeNames = {
            'line': 'Line',
            'rectangle': 'Rectangle',
            'circle': 'Circle'
        };
        document.getElementById('current-mode-display').textContent = shapeNames[mode] || 'Shape';
    }
}

function toggleGrid() {
    gridVisible = !gridVisible;
    redrawCanvas();
}

function updateModeDisplay() {
    const modeEl = document.getElementById('current-mode-display');
    if (deleteMeasureMode) {
        modeEl.textContent = 'Delete Measure';
    } else if (measureMode) {
        modeEl.textContent = 'Measure';
    } else if (shapeSelectMode) {
        modeEl.textContent = 'Select Shape';
    } else if (textSelectMode) {
        modeEl.textContent = 'Select Text';
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
            redoStack = [];
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

// ==================== SAVE & SHARE ====================
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
