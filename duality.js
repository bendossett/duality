const WIDTH = 5;
const HEIGHT = 5;

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;

const dragThreshold = 0.1;

let primal;
let dual;

let drawSegments = true;

let scaleFactor = 1.0;
let offsetX = 0.0;
let offsetY = 0.0;
let targetOffsetX = 0.0;
let targetOffsetY = 0.0;

window.onload = () => {
    document.querySelector("#mode-select").addEventListener("click", setModeStatus);
}

function setModeStatus() {
    drawSegments = !drawSegments;

    if (drawSegments) {
        document.querySelector("#mode-status").innerHTML = "SEGMENT";
    } else {
        document.querySelector("#mode-status").innerHTML = "LINE";
    }
}

// From p5.js
function map(n, start1, stop1, start2, stop2) {
    return (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
};

function canvas2coord(px, py) {
    const scale = 1 / scaleFactor;
    let x = map(px, 0, CANVAS_WIDTH, 0, (scale * WIDTH) * 2);
    let y = map(py, 0, CANVAS_HEIGHT, 0, (scale * HEIGHT) * 2);
    return [Math.min(Math.max((x - (scale * WIDTH)) - offsetX, -((scale * WIDTH) / 2)), ((scale * WIDTH))), 
            Math.min(Math.max((-(y - (scale * HEIGHT))) - offsetY, -((scale * HEIGHT))), ((scale * HEIGHT)))];
}

function coord2canvas(px, py) {
    const scale = 1 / scaleFactor;
    let x = map((px + offsetX) + (scale * WIDTH), 0, (scale * WIDTH) * 2, 0, CANVAS_WIDTH);
    let y = map((scale * HEIGHT) - (py + offsetY), 0, (scale * HEIGHT) * 2, 0, CANVAS_HEIGHT);
    return [x, y];
}

function euclidean(p1, p2) {
    return Math.sqrt(Math.pow((p2[0] - p1[0]), 2) + Math.pow((p2[1] - p1[1]), 2))
}

const Primitives = {
    Ellipse: 0,
    Line: 1,
    Segment: 2,
    Wedge: 3
}

class Primitive {
    constructor(type, ...args) {
        this.type = type;
        this.args = args;
    }
}

class DualityCanvas {
    constructor(sketch, xDim, yDim, isPrimal) {
        this.sketch = sketch;

        this.sketch.setup = () => {
            this.canvas = this.sketch.createCanvas(xDim, yDim);

            if (isPrimal) {
                this.canvas.parent('primal');
            } else {
                this.canvas.parent('dual');
            }

            this.canvas.mousePressed((e) => this.onMousePressed(e));
            this.canvas.mouseMoved((e) => this.onMouseDragged(e));
            this.canvas.mouseReleased((e) => this.onMouseReleased(e));

            this.canvas.mouseWheel(e => {
                const amnt = e.deltaY * 0.001;
                scaleFactor += amnt;
                scaleFactor = Math.max(Math.min(scaleFactor, 10.0), 0.1);
                return false;
            });

            this.sketch.stroke(0);
            this.sketch.line(this.sketch.width / 2, 0, this.sketch.width / 2, this.sketch.height);
            this.sketch.line(0, this.sketch.height / 2, this.sketch.width, this.sketch.height / 2);
            
            for (let element of document.getElementsByClassName("p5Canvas")) {
                element.addEventListener("contextmenu", (e) => e.preventDefault());
            }
        }

        this.sketch.draw = () => this.draw();

        this.mouseWasPressed = false;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        this.rightMouseWasPressed = false;
        this.rightDragX = 0;
        this.rightDragY = 0;

        this.isPrimal = isPrimal;

        this.needsDraw = [];
    }

    onMousePressed(e) {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        switch (this.sketch.mouseButton) {
            case this.sketch.LEFT:
                if (!this.mouseWasPressed) {
                    this.mouseWasPressed = true;
                    this.mouseDownX = x;
                    this.mouseDownY = y;
                }
                break;

            case this.sketch.CENTER:
                break;

            case this.sketch.RIGHT:
                if (!this.rightMouseWasPressed) {
                    this.rightMouseWasPressed = true;
                    this.rightDragX = this.sketch.mouseX;
                    this.rightDragY = this.sketch.mouseY;
                }
                break;
        }
    }

    onMouseDragged(e) {
        if (this.rightMouseWasPressed && e.buttons === 2) {
            targetOffsetX += map(this.sketch.mouseX - this.rightDragX, 0, 700, 0, 2*WIDTH);
            targetOffsetY += -map(this.sketch.mouseY - this.rightDragY, 0, 700, 0, 2*HEIGHT);
            this.rightDragX = this.sketch.mouseX;
            this.rightDragY = this.sketch.mouseY;
        }
    }

    onMouseReleased(e) {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        switch (this.sketch.mouseButton) {
            case this.sketch.LEFT:

                if (this.mouseWasPressed) {

                    this.mouseWasPressed = false;

                    if (euclidean([x, y], [this.mouseDownX, this.mouseDownY]) > dragThreshold) {

                        if (drawSegments) {
                            this.drawPrimitive(Primitives.Segment, this.mouseDownX, this.mouseDownY, x, y);

                            if (this.isPrimal) {
                                dual.drawPrimitive(Primitives.Wedge, this.mouseDownX, this.mouseDownY, x, y);
                            } else {
                                primal.drawPrimitive(Primitives.Wedge, this.mouseDownX, this.mouseDownY, x, y);
                            }
                        } else {
                            let a = (y - this.mouseDownY) / (x - this.mouseDownX);
                            let b = 0 - (y - (a * x));

                            this.drawPrimitive(Primitives.Line, a, b);

                            if (this.isPrimal) {
                                dual.drawPrimitive(Primitives.Ellipse, a, b);
                            } else {
                                primal.drawPrimitive(Primitives.Ellipse, a, b);
                            }
                        }

                    } else {
                        // Didn't drag, draw point
                        this.drawPrimitive(Primitives.Ellipse, x, y);
                        if (this.isPrimal) {
                            dual.drawPrimitive(Primitives.Line, x, y);
                        } else {
                            primal.drawPrimitive(Primitives.Line, x, y);
                        }
                    }
                }
                break;

            case this.sketch.CENTER:
                break;

            case this.sketch.RIGHT:
                this.rightMouseWasPressed = false;
                break;
        }

    }

    drawPrimitive(type, ...args) {
        this.needsDraw.push(new Primitive(type, ...args));
    }

    drawGrid() {
        this.sketch.stroke(0);

        const [yAxisP1X, yAxisP1Y] = coord2canvas(0, -(HEIGHT * 10));
        const [yAxisP2X, yAxisP2Y] = coord2canvas(0, (HEIGHT * 10));
        this.sketch.line(yAxisP1X, yAxisP1Y, yAxisP2X, yAxisP2Y);

        const [xAxisP1X, xAxisP1Y] = coord2canvas(-(WIDTH * 10), 0);
        const [xAxisP2X, xAxisP2Y] = coord2canvas((WIDTH * 10), 0);
        this.sketch.line(xAxisP1X, xAxisP1Y, xAxisP2X, xAxisP2Y);

        for (let i = -(WIDTH * 10); i < (WIDTH * 10); i++) {
            const [x1, y1] = coord2canvas(i, -0.1);
            const [x2, y2] = coord2canvas(i, 0.1);
            this.sketch.line(x1, y1, x2, y2);
        }

        for (let i = -(HEIGHT * 10); i < (HEIGHT * 10); i++) {
            const [x1, y1] = coord2canvas(-0.1, i);
            const [x2, y2] = coord2canvas(0.1, i);
            this.sketch.line(x1, y1, x2, y2);
        }
    }

    draw() {
        this.sketch.clear();

        offsetX = this.sketch.lerp(offsetX, targetOffsetX, 0.1);
        offsetY = this.sketch.lerp(offsetY, targetOffsetY, 0.1);

        this.drawGrid();

        this.sketch.stroke(0);
        this.sketch.fill(0);
        for (let i = 0; i < this.needsDraw.length; i++) {
            let p = this.needsDraw[i];

            if (p.type === Primitives.Ellipse) {

                let [coordX, coordY] = p.args;
                let [x, y] = coord2canvas(coordX, coordY);

                this.sketch.ellipse(x, y, 10, 10);

            } else if (p.type === Primitives.Segment) {

                let [x1, y1, x2, y2] = p.args;

                let p1 = coord2canvas(x1, y1);
                let p2 = coord2canvas(x2, y2);

                this.sketch.line(p1[0], p1[1], p2[0], p2[1]);

            } else if (p.type === Primitives.Line) {

                let [a, b] = p.args;

                let p1 = [(-(WIDTH * 10) + b) / a, -(WIDTH * 10)];
                let p2 = [((WIDTH * 10) + b) / a, (WIDTH * 10)];

                let p1Canvas = coord2canvas(p1[0], p1[1]);
                let p2Canvas = coord2canvas(p2[0], p2[1]);

                this.sketch.line(p1Canvas[0], p1Canvas[1], p2Canvas[0], p2Canvas[1]);

            } else if (p.type === Primitives.Wedge) {

                let [a1, b1, a2, b2] = p.args;

                let bLine1 = coord2canvas((-(WIDTH * 10) + b1) / a1, -(WIDTH * 10));
                let tLine1 = coord2canvas(((WIDTH * 10) + b1) / a1, (WIDTH * 10));

                let bLine2 = coord2canvas((-(WIDTH * 10) + b2) / a2, -(WIDTH * 10));
                let tLine2 = coord2canvas(((WIDTH * 10) + b2) / a2, (WIDTH * 10));

                this.sketch.line(bLine1[0], bLine1[1], tLine1[0], tLine1[1]);
                this.sketch.line(bLine2[0], bLine2[1], tLine2[0], tLine2[1]);

                let intersection = [(b2 - b1) / (a2 - a1), a1 * ((b2 - b1) / (a2 - a1)) - b1];
                let intersection_canvas = coord2canvas(...intersection);

                this.sketch.fill(255, 0, 0, 80);
                this.sketch.stroke(0, 0, 0, 0);

                if ((a1 < 0 && a2 > 0) || (a2 < 0 && a1 > 0)) {
                    this.sketch.beginShape();
                    this.sketch.vertex(...bLine1);
                    this.sketch.vertex(...tLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();

                    this.sketch.beginShape();
                    this.sketch.vertex(...tLine1);
                    this.sketch.vertex(...bLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();
                } else {
                    this.sketch.beginShape();
                    this.sketch.vertex(...tLine1);
                    this.sketch.vertex(...tLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();

                    this.sketch.beginShape();
                    this.sketch.vertex(...bLine1);
                    this.sketch.vertex(...bLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();
                }
                this.sketch.stroke(0);
            }
        }
    }
}

// Reference https://editor.p5js.org/caminofarol/sketches/r609C2cs
const primalConstructor = (sketch) => {
    primal = new DualityCanvas(sketch, CANVAS_WIDTH, CANVAS_HEIGHT, true);
}

const dualConstructor = (sketch) => {
    dual = new DualityCanvas(sketch, CANVAS_WIDTH, CANVAS_HEIGHT, false);
}

new p5(primalConstructor);
new p5(dualConstructor);