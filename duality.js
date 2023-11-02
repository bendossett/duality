const primalPoints = [];
const primalSegments = [];
const primalLines = [];
const primalWedges = [];

const dualPoints = [];
const dualSegments = [];
const dualLines = [];
const dualWedges = [];

const dragThreshold = 20;

let mouseWasPressed = false;
let mouseDownX;
let mouseDownY;

let primal;
let dual;

function canvas2coord(x, y) {
    return [Math.min(Math.max(x - 200, -200), 200), Math.min(Math.max(400 - y - 200, -200), 200)];
}

function coord2canvas(x, y) {
    return [x + 200, 400 - (y + 200)];
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
    constructor(sketch, xDim, yDim, xPos, yPos, name) {
        this.sketch = sketch;

        this.sketch.setup = () => {
            this.canvas = this.sketch.createCanvas(xDim, yDim);
            this.canvas.position(xPos, yPos);

            this.canvas.mousePressed(() => this.onMousePressed());
            this.canvas.mouseReleased(() => this.onMouseReleased());

            this.sketch.stroke(0);
            this.sketch.line(this.sketch.width / 2, 0, this.sketch.width / 2, this.sketch.height);
            this.sketch.line(0, this.sketch.height / 2, this.sketch.width, this.sketch.height / 2);
        }
    
        this.sketch.draw = () => this.draw();

        this.mouseWasPressed = false;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        this.name = name;

        this.needsDraw = [];
        this.noDraw = [];
    }

    onMousePressed() {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        if (!this.mouseWasPressed) {
            this.mouseWasPressed = true;
            this.mouseDownX = x;
            this.mouseDownY = y;
        }
    }

    onMouseReleased() {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        if (this.mouseWasPressed) {
    
            this.mouseWasPressed = false;

            if (euclidean([x, y], [this.mouseDownX, this.mouseDownY]) > dragThreshold) {
                this.needsDraw.push(new Primitive(Primitives.Segment, this.mouseDownX, this.mouseDownY, x, y));
            } else {
                // Didn't drag, draw point
                this.needsDraw.push(new Primitive(Primitives.Ellipse, x, y, 30, 30));
            }
        }
    }

    draw() {
        this.sketch.stroke(0);
        for (let i = 0; i < this.needsDraw.length; i++) {
            let p = this.needsDraw[i];

            if (p.type === Primitives.Ellipse) {
                let [coordX, coordY, w, h] = p.args;
                let [x, y] = coord2canvas(coordX, coordY);

                this.sketch.ellipse(x, y, w, h);
            } else if (p.type === Primitives.Segment) {
                let [x1, y1, x2, y2] = p.args;

                let p1 = coord2canvas(x1, y1);
                let p2 = coord2canvas(x2, y2);

                this.sketch.line(p1[0], p1[1], p2[0], p2[1]);
            }

            this.noDraw.push(p);
        }
        this.needsDraw = [];
    }
}

// Reference https://editor.p5js.org/caminofarol/sketches/r609C2cs
const primalConstructor = (sketch) => {
    primal = new DualityCanvas(sketch, 400, 400, 0, 0, "p");
}

const dualConstructor = (sketch) => {
    dual = new DualityCanvas(sketch, 400, 400, 400, 0, "d");
}

new p5(primalConstructor);
new p5(dualConstructor);