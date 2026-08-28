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
